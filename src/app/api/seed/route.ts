import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { UserRole, VerificationStatus } from "@prisma/client"
import bcrypt from "bcryptjs"

export async function GET() {
    try {
        console.log("Seeding demo profiles via API...")

        // --- DOCTOR ---
        const doctorEmail = "dr.west@breastscreen.dev"
        const doctorPassword = "Doctor@West1"
        const doctorName = "Dr. West (Test)"

        let doctorExisting = await prisma.user.findUnique({ where: { email: doctorEmail } })
        if (doctorExisting) {
            const doctor = await prisma.doctor.findUnique({ where: { userId: doctorExisting.id } })
            if (doctor && doctor.verificationStatus !== VerificationStatus.VERIFIED) {
                await prisma.doctor.update({
                    where: { id: doctor.id },
                    data: { verificationStatus: VerificationStatus.VERIFIED, licenseVerifiedAt: new Date() },
                })
            }
            if (!doctorExisting.emailVerified) {
                await prisma.user.update({
                    where: { id: doctorExisting.id },
                    data: { emailVerified: new Date() },
                })
            }
        } else {
            const passwordHash = await bcrypt.hash(doctorPassword, 12)
            await prisma.$transaction(async (tx) => {
                const newUser = await tx.user.create({
                    data: {
                        email: doctorEmail,
                        passwordHash,
                        name: doctorName,
                        phoneNumber: "+19175550100",
                        role: UserRole.DOCTOR,
                        emailVerified: new Date(),
                    },
                })

                await tx.doctor.create({
                    data: {
                        userId: newUser.id,
                        licenseNumber: "WEST-MED-2026-0001",
                        licenseVerifiedAt: new Date(),
                        licenseExpiry: new Date("2028-12-31"),
                        specialty: "Radiology - Breast Imaging",
                        assignedRegions: ["WEST"],
                        verificationStatus: VerificationStatus.VERIFIED,
                    },
                })
            })
        }

        // --- PATIENT ---
        const patientEmail = "patient.west@breastscreen.dev"
        const patientPassword = "Patient@West1"
        const patientName = "Jane Doe (Test Patient)"

        let patientExisting = await prisma.user.findUnique({ where: { email: patientEmail } })
        if (patientExisting) {
            if (!patientExisting.emailVerified) {
                await prisma.user.update({
                    where: { id: patientExisting.id },
                    data: { emailVerified: new Date() },
                })
            }
        } else {
            const passwordHash = await bcrypt.hash(patientPassword, 12)
            await prisma.$transaction(async (tx) => {
                const newUser = await tx.user.create({
                    data: {
                        email: patientEmail,
                        passwordHash,
                        name: patientName,
                        phoneNumber: "+19175550200",
                        role: UserRole.PATIENT,
                        emailVerified: new Date(),
                    },
                })

                await tx.patient.create({
                    data: {
                        userId: newUser.id,
                        regionCode: "WEST",
                        consentSignedAt: new Date(),
                        consentVersion: "1.0",
                    },
                })
            })
        }

        return NextResponse.json({
            success: true,
            message: "Demo users created successfully in the cloud database!",
            credentials: {
                doctor: {
                    email: doctorEmail,
                    password: doctorPassword
                },
                patient: {
                    email: patientEmail,
                    password: patientPassword
                }
            }
        })
    } catch (error) {
        console.error("Seed API failed:", error)
        return NextResponse.json({ error: "Failed to seed demo users" }, { status: 500 })
    }
}
