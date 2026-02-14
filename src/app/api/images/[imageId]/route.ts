import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { readFromStorage } from "@/lib/storage"

/**
 * Secure image serving endpoint
 * Only allows access to authorized users (doctors reviewing cases, patients viewing their own)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ imageId: string }> }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { imageId } = await params

        // Find the image
        const image = await prisma.imageMetadata.findUnique({
            where: { id: imageId },
            include: {
                case: {
                    include: {
                        patient: true
                    }
                }
            }
        })

        if (!image) {
            return NextResponse.json({ error: "Image not found" }, { status: 404 })
        }

        // Authorization check
        let authorized = false
        let accessorType = ""

        if (session.user.role === "DOCTOR") {
            const doctor = await prisma.doctor.findUnique({
                where: { userId: session.user.id }
            })

            if (doctor && doctor.verificationStatus === "VERIFIED") {
                // Doctor must be assigned to case or in the region
                const isAssigned = image.case.assignedDoctorId === doctor.id
                const isInRegion = doctor.assignedRegions.includes(image.case.regionCode)

                if (isAssigned || isInRegion) {
                    authorized = true
                    accessorType = "DOCTOR"
                }
            }
        } else if (session.user.role === "PATIENT") {
            const patient = await prisma.patient.findUnique({
                where: { userId: session.user.id }
            })

            if (patient && image.case.patientId === patient.id) {
                authorized = true
                accessorType = "PATIENT"
            }
        } else if (session.user.role === "ADMIN") {
            authorized = true
            accessorType = "ADMIN"
        }

        if (!authorized) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        // Log the access
        await prisma.dataAccessLog.create({
            data: {
                accessorId: session.user.id,
                accessorType,
                caseId: image.caseId,
                accessType: "VIEW",
                justification: `Viewing image ${imageId}`,
            }
        })

        // Read and return the image
        try {
            const imageBuffer = await readFromStorage(image.storageReference)

            // Determine content type
            const ext = image.storageReference.split(".").pop()?.toLowerCase()
            let contentType = "application/octet-stream"

            if (ext === "dcm" || ext === "dicom") {
                contentType = "application/dicom"
            } else if (ext === "png") {
                contentType = "image/png"
            } else if (ext === "jpg" || ext === "jpeg") {
                contentType = "image/jpeg"
            }

            return new NextResponse(imageBuffer, {
                status: 200,
                headers: {
                    "Content-Type": contentType,
                    "Cache-Control": "private, max-age=3600",
                    "Content-Disposition": `inline; filename="${imageId}.${ext}"`,
                }
            })
        } catch (storageError) {
            console.error("Failed to read image from storage:", storageError)
            return NextResponse.json(
                { error: "Failed to retrieve image" },
                { status: 500 }
            )
        }

    } catch (error) {
        console.error("Image serving error:", error)
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        )
    }
}
