import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

interface UploadedImage {
    publicId: string
    url: string
    originalFilename: string
    format: string
    bytes: number
}

/**
 * Receives metadata about images that were uploaded directly to Cloudinary
 * from the browser. Creates the case + image records in the database.
 * No large file data is sent here — just small JSON metadata.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "PATIENT") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const patient = await prisma.patient.findUnique({
            where: { userId: session.user.id },
        })

        if (!patient) {
            return NextResponse.json({ error: "Patient profile not found" }, { status: 404 })
        }

        if (!patient.consentSignedAt) {
            return NextResponse.json(
                { error: "Please sign the consent form before uploading images" },
                { status: 403 }
            )
        }

        const body = await request.json()
        const images: UploadedImage[] = body.images

        if (!images || images.length === 0) {
            return NextResponse.json({ error: "No images provided" }, { status: 400 })
        }

        // Create a new case
        const newCase = await prisma.case.create({
            data: {
                patientId: patient.id,
                regionCode: patient.regionCode,
                status: "PENDING_REVIEW",
            },
        })

        const uploadedImages = []

        for (const img of images) {
            // Determine view/laterality from filename
            const name = (img.originalFilename || "").toUpperCase()
            let viewPosition: string | null = null
            let laterality: string | null = null

            if (name.includes("CC")) viewPosition = "CC"
            else if (name.includes("MLO")) viewPosition = "MLO"

            if (name.includes("LEFT") || name.includes("_L_") || name.startsWith("L_"))
                laterality = "LEFT"
            else if (name.includes("RIGHT") || name.includes("_R_") || name.startsWith("R_"))
                laterality = "RIGHT"

            // Storage reference: the Cloudinary public_id prefixed so readFromStorage knows
            const resourceType = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "tiff"].includes(
                img.format?.toLowerCase() || ""
            )
                ? "image"
                : "raw"
            const storageReference = `cloudinary:${resourceType}:${img.publicId}`

            const imageRecord = await prisma.imageMetadata.create({
                data: {
                    caseId: newCase.id,
                    storageReference,
                    modality: "MG",
                    viewPosition,
                    laterality,
                    imageHashSha256: img.publicId, // Use publicId as unique identifier
                },
            })

            uploadedImages.push({
                id: imageRecord.id,
                viewPosition,
                laterality,
                uploadedAt: imageRecord.uploadedAt,
            })
        }

        // If nothing worked, clean up
        if (uploadedImages.length === 0) {
            await prisma.case.delete({ where: { id: newCase.id } })
            return NextResponse.json({ error: "No images could be processed" }, { status: 400 })
        }

        // Log the upload
        await prisma.accessLog.create({
            data: {
                userId: session.user.id,
                action: "UPLOAD_IMAGES",
                resourceType: "CASE",
                resourceId: newCase.id,
                metadata: { imageCount: uploadedImages.length },
            },
        })

        // Assign to a doctor based on region
        const availableDoctor = await prisma.doctor.findFirst({
            where: {
                verificationStatus: "VERIFIED",
                assignedRegions: { has: patient.regionCode },
            },
            orderBy: {
                assignedCases: { _count: "asc" },
            },
        })

        if (availableDoctor) {
            await prisma.case.update({
                where: { id: newCase.id },
                data: {
                    assignedDoctorId: availableDoctor.id,
                    assignedAt: new Date(),
                },
            })
        }

        return NextResponse.json({
            success: true,
            caseId: newCase.id,
            uploadedImages,
            message: `${uploadedImages.length} image(s) uploaded successfully`,
        })
    } catch (error) {
        console.error("Save case error:", error)
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
    }
}
