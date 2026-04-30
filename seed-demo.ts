/**
 * Seed script: Create dummy doctor and patient profiles for testing.
 *
 * Usage:
 *   npx tsx seed-demo.ts
 *
 * Credentials created:
 *   Doctor Email:  dr.west@breastscreen.dev
 *   Password:      Doctor@West1
 * 
 *   Patient Email: patient.west@breastscreen.dev
 *   Password:      Patient@West1
 */

import { PrismaClient, UserRole, VerificationStatus } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
    console.log("Seeding demo profiles...")

    // --- DOCTOR ---
    const doctorEmail = "dr.west@breastscreen.dev"
    const doctorPassword = "Doctor@West1"
    const doctorName = "Dr. West (Test)"

    let doctorExisting = await prisma.user.findUnique({ where: { email: doctorEmail } })
    if (doctorExisting) {
        console.log(`\nDoctor already exists (${doctorEmail}). Ensuring verification...`)
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
        console.log(`  -> Doctor ready.`)
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

            await tx.accessLog.create({
                data: {
                    userId: newUser.id,
                    action: "REGISTER",
                    resourceType: "ACCOUNT",
                    metadata: { type: "doctor", source: "seed-script" },
                },
            })
        })
        console.log(`  -> Doctor created: ${doctorEmail}`)
    }

    // --- PATIENT ---
    const patientEmail = "patient.west@breastscreen.dev"
    const patientPassword = "Patient@West1"
    const patientName = "Jane Doe (Test Patient)"

    let patientExisting = await prisma.user.findUnique({ where: { email: patientEmail } })
    if (patientExisting) {
        console.log(`\nPatient already exists (${patientEmail}).`)
        if (!patientExisting.emailVerified) {
            await prisma.user.update({
                where: { id: patientExisting.id },
                data: { emailVerified: new Date() },
            })
        }
        console.log(`  -> Patient ready.`)
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

            await tx.accessLog.create({
                data: {
                    userId: newUser.id,
                    action: "REGISTER",
                    resourceType: "ACCOUNT",
                    metadata: { type: "patient", source: "seed-script" },
                },
            })
        })
        console.log(`  -> Patient created: ${patientEmail}`)
    }

    console.log("\n=== Demo Profiles ===")
    console.log(`[DOCTOR]`)
    console.log(`  Email:    ${doctorEmail}`)
    console.log(`  Password: ${doctorPassword}`)
    console.log(`\n[PATIENT]`)
    console.log(`  Email:    ${patientEmail}`)
    console.log(`  Password: ${patientPassword}`)
    console.log("=====================\n")
}

main()
    .catch((e) => {
        console.error("Seed failed:", e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
