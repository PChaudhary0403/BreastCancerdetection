import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

const verifySchema = z.object({
    action: z.enum(["verify", "revoke"])
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ doctorId: string }> }
) {
    try {
        const session = await getServerSession(authOptions)

        if (!session || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { doctorId } = await params

        const admin = await prisma.admin.findUnique({
            where: { userId: session.user.id }
        })

        if (!admin) {
            return NextResponse.json({ error: "Admin not found" }, { status: 403 })
        }

        const body = await request.json()
        const { action } = verifySchema.parse(body)

        // Find the doctor
        const doctor = await prisma.doctor.findUnique({
            where: { id: doctorId },
            include: { user: true }
        })

        if (!doctor) {
            return NextResponse.json({ error: "Doctor not found" }, { status: 404 })
        }

        // Perform the action
        const newStatus = action === "verify" ? "VERIFIED" : "REVOKED"

        await prisma.$transaction(async (tx) => {
            // Update doctor verification status
            await tx.doctor.update({
                where: { id: doctorId },
                data: {
                    verificationStatus: newStatus,
                    licenseVerifiedAt: action === "verify" ? new Date() : null,
                }
            })

            // Log the action
            await tx.accessLog.create({
                data: {
                    userId: session.user.id,
                    action: action === "verify" ? "VERIFY_DOCTOR" : "REVOKE_DOCTOR",
                    resourceType: "DOCTOR",
                    resourceId: doctorId,
                    metadata: {
                        doctorEmail: doctor.user.email,
                        licenseNumber: doctor.licenseNumber,
                        previousStatus: doctor.verificationStatus,
                        newStatus: newStatus,
                    }
                }
            })
        })

        return NextResponse.json({
            success: true,
            message: action === "verify"
                ? "Doctor verified successfully"
                : "Doctor verification revoked",
            newStatus
        })

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: error.issues[0].message },
                { status: 400 }
            )
        }

        console.error("Doctor verification error:", error)
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        )
    }
}
