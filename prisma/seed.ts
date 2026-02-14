import { PrismaClient, UserRole, AccountStatus, VerificationStatus, CaseStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('Seed: Starting...')

    // 1. Create Admin
    const adminPassword = await bcrypt.hash('admin123', 12)
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@manifest.ai' },
        update: {},
        create: {
            email: 'admin@manifest.ai',
            name: 'Global Administrator',
            passwordHash: adminPassword,
            role: UserRole.ADMIN,
            admin: {
                create: {
                    permissions: { full: true }
                }
            }
        }
    })
    console.log('Seed: Admin created')

    // 2. Create Verified Doctor
    const doctorPassword = await bcrypt.hash('doctor123', 12)
    const doctorUser = await prisma.user.upsert({
        where: { email: 'doctor@manifest.ai' },
        update: {},
        create: {
            email: 'doctor@manifest.ai',
            name: 'Dr. Sarah Wilson',
            passwordHash: doctorPassword,
            role: UserRole.DOCTOR,
            doctor: {
                create: {
                    licenseNumber: 'MD123456',
                    licenseExpiry: new Date('2026-12-31'),
                    specialty: 'Radiology',
                    assignedRegions: ['REGION-NORTH', 'REGION-SOUTH'],
                    verificationStatus: VerificationStatus.VERIFIED,
                    licenseVerifiedAt: new Date()
                }
            }
        }
    })
    const doctor = await prisma.doctor.findUnique({ where: { userId: doctorUser.id } })
    console.log('Seed: Doctor created and verified')

    // 3. Create Patient
    const patientPassword = await bcrypt.hash('patient123', 12)
    const patientUser = await prisma.user.upsert({
        where: { email: 'patient@example.com' },
        update: {},
        create: {
            email: 'patient@example.com',
            name: 'Jane Doe',
            passwordHash: patientPassword,
            role: UserRole.PATIENT,
            patient: {
                create: {
                    regionCode: 'REGION-NORTH',
                    consentSignedAt: new Date(),
                    consentVersion: 'v1.0',
                    dateOfBirth: new Date('1985-05-15')
                }
            }
        }
    })
    const patient = await prisma.patient.findUnique({ where: { userId: patientUser.id } })
    console.log('Seed: Patient created')

    // 4. Create a Case for the patient
    if (patient && doctor) {
        const caseData = await prisma.case.create({
            data: {
                patientId: patient.id,
                regionCode: 'REGION-NORTH',
                status: CaseStatus.PENDING_REVIEW,
                assignedDoctorId: doctor.id,
                assignedAt: new Date(),
                images: {
                    create: [
                        {
                            storageReference: 'CBIS-DDSM/Calc-Test_P_00038_LEFT_CC/1.3.6.1.4.1.9590.100.1.2.85960834310914757119307232671107233785/1.3.6.1.4.1.9590.100.1.2.373087353513385552327651130541199652552/000000.dcm',
                            viewPosition: 'CC',
                            laterality: 'LEFT',
                            imageHashSha256: 'dummy-hash-1'
                        },
                        {
                            storageReference: 'CBIS-DDSM/Calc-Test_P_00038_LEFT_MLO/1.3.6.1.4.1.9590.100.1.2.203303681411516709228801937981504958178/1.3.6.1.4.1.9590.100.1.2.148685161011504996412170889271638644670/000000.dcm',
                            viewPosition: 'MLO',
                            laterality: 'LEFT',
                            imageHashSha256: 'dummy-hash-2'
                        }
                    ]
                }
            }
        })
        console.log('Seed: Case created with 2 images')
    }

    console.log('Seed: Completed successfully')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
