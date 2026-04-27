import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import {
    generateStorageReference,
    calculateFileHash,
    saveToStorage
} from "@/lib/storage"
import {
    detectFileType,
    parseDicomHeader,
    extractViewPosition,
    extractLaterality,
    sanitizeFilename
} from "@/lib/dicom"

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024

export async function POST(request: NextRequest) {
    try {
        // Authenticate user
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "PATIENT") {
            return NextResponse.json(
                { error: "Unauthorized. Only patients can upload images." },
                { status: 401 }
            )
        }

        // Get patient record
        const patient = await prisma.patient.findUnique({
            where: { userId: session.user.id }
        })

        if (!patient) {
            return NextResponse.json(
                { error: "Patient profile not found" },
                { status: 404 }
            )
        }

        // Check consent
        if (!patient.consentSignedAt) {
            return NextResponse.json(
                { error: "Please sign the consent form before uploading images" },
                { status: 403 }
            )
        }

        // Parse multipart form data
        const formData = await request.formData()
        const files = formData.getAll("images") as File[]

        if (!files || files.length === 0) {
            return NextResponse.json(
                { error: "No files provided" },
                { status: 400 }
            )
        }

        if (files.length > 4) {
            return NextResponse.json(
                { error: "Maximum 4 images allowed per submission" },
                { status: 400 }
            )
        }

        // Create a new case for this submission
        const newCase = await prisma.case.create({
            data: {
                patientId: patient.id,
                regionCode: patient.regionCode,
                status: "PENDING_REVIEW",
            }
        })

        const uploadedImages = []
        const errors = []

        for (const file of files) {
            try {
                // Check file size
                if (file.size > MAX_FILE_SIZE) {
                    errors.push(`${file.name}: File too large (max 50MB)`)
                    continue
                }

                // Read file into buffer
                const arrayBuffer = await file.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                // Detect file type
                const fileType = detectFileType(buffer, file.name)
                if (!fileType.valid) {
                    errors.push(`${file.name}: ${fileType.error}`)
                    continue
                }

                // Parse DICOM if applicable
                let viewPosition: string | null = null
                let laterality: string | null = null

                if (fileType.type === "dicom") {
                    const metadata = parseDicomHeader(buffer)

                    if (!metadata.isValid) {
                        errors.push(`${file.name}: ${metadata.validationErrors.join(", ")}`)
                        continue
                    }

                    viewPosition = extractViewPosition(file.name, metadata)
                    laterality = extractLaterality(file.name, metadata)
                } else {
                    // For non-DICOM, try to extract from filename
                    const sanitizedName = sanitizeFilename(file.name)
                    viewPosition = extractViewPosition(sanitizedName, {
                        viewPosition: null
                    } as any)
                    laterality = extractLaterality(sanitizedName, {
                        laterality: null
                    } as any)
                }

                // Calculate file hash for integrity
                const fileHash = await calculateFileHash(buffer)

                // Check for duplicate uploads
                const existingImage = await prisma.imageMetadata.findFirst({
                    where: { imageHashSha256: fileHash }
                })

                if (existingImage) {
                    errors.push(`${file.name}: This image has already been uploaded`)
                    continue
                }

                // Generate secure storage reference (no patient info in path)
                // Map detected types to file extensions
                const extensionMap: Record<string, string> = {
                    dicom: "dcm",
                    jpeg: "jpg",
                    png: "png",
                    tiff: "tiff",
                    bmp: "bmp",
                    webp: "webp",
                }
                const extension = extensionMap[fileType.type] ?? fileType.type
                const storageReference = generateStorageReference(extension)

                // Save to storage
                const storagePath = await saveToStorage(buffer, storageReference, "images")

                // Create image metadata record
                const imageRecord = await prisma.imageMetadata.create({
                    data: {
                        caseId: newCase.id,
                        storageReference: storagePath,
                        modality: "MG",
                        viewPosition,
                        laterality,
                        imageHashSha256: fileHash,
                    }
                })

                uploadedImages.push({
                    id: imageRecord.id,
                    viewPosition,
                    laterality,
                    uploadedAt: imageRecord.uploadedAt,
                })

            } catch (fileError) {
                console.error(`Error processing file ${file.name}:`, fileError)
                errors.push(`${file.name}: Failed to process file`)
            }
        }

        // If no images were successfully uploaded, delete the case
        if (uploadedImages.length === 0) {
            await prisma.case.delete({ where: { id: newCase.id } })
            return NextResponse.json(
                {
                    error: "No images could be processed",
                    details: errors
                },
                { status: 400 }
            )
        }

        // Log the upload action
        await prisma.accessLog.create({
            data: {
                userId: session.user.id,
                action: "UPLOAD_IMAGES",
                resourceType: "CASE",
                resourceId: newCase.id,
                metadata: {
                    imageCount: uploadedImages.length,
                    errorCount: errors.length,
                }
            }
        })

        // Assign to a doctor based on region
        const availableDoctor = await prisma.doctor.findFirst({
            where: {
                verificationStatus: "VERIFIED",
                assignedRegions: { has: patient.regionCode }
            },
            orderBy: {
                assignedCases: { _count: "asc" }
            }
        })

        if (availableDoctor) {
            await prisma.case.update({
                where: { id: newCase.id },
                data: {
                    assignedDoctorId: availableDoctor.id,
                    assignedAt: new Date(),
                }
            })
        }

        return NextResponse.json({
            success: true,
            caseId: newCase.id,
            uploadedImages,
            errors: errors.length > 0 ? errors : undefined,
            message: uploadedImages.length === files.length
                ? "All images uploaded successfully"
                : `${uploadedImages.length} of ${files.length} images uploaded successfully`,
        })

    } catch (error) {
        console.error("Upload error:", error)
        return NextResponse.json(
            { error: "An unexpected error occurred during upload" },
            { status: 500 }
        )
    }
}

// GET endpoint to check upload limits
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({
        maxFileSize: MAX_FILE_SIZE,
        maxFiles: 4,
        allowedFormats: ["DICOM (.dcm)", "JPEG (.jpg/.jpeg)", "PNG (.png)", "TIFF (.tif/.tiff)", "BMP (.bmp)", "WebP (.webp)"],
        modality: "Mammography (MG)",
    })
}
