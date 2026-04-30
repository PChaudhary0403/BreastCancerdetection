import { z } from "zod"
import bcrypt from "bcryptjs"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import crypto from "crypto"
import { sendOTPEmail } from "@/lib/email"

// Registration schemas with validation
const patientRegistrationSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number"),
    name: z.string().min(2, "Name must be at least 2 characters"),
    phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Valid phone number is required"),
    regionCode: z.string().min(2, "Region code is required"),
    consentAccepted: z.boolean().refine(val => val === true, {
        message: "You must accept the consent form"
    })
})

const doctorRegistrationSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number"),
    name: z.string().min(2, "Name must be at least 2 characters"),
    phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Valid phone number is required"),
    licenseNumber: z.string().min(5, "License number is required"),
    licenseExpiry: z.string().refine(val => new Date(val) > new Date(), {
        message: "License must not be expired"
    }),
    specialty: z.string().min(2, "Specialty is required"),
    assignedRegions: z.array(z.string()).min(1, "At least one region is required")
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, type, otp } = body

        if (action === "send-otp") {
            // Validate data first so we don't send OTP if data is invalid
            let validatedData;
            if (type === "patient") {
                validatedData = patientRegistrationSchema.parse(body);
            } else if (type === "doctor") {
                validatedData = doctorRegistrationSchema.parse(body);
                // Extra check for doctor license
                const existingDoctor = await prisma.doctor.findUnique({
                    where: { licenseNumber: validatedData.licenseNumber }
                })
                if (existingDoctor) {
                    return NextResponse.json({ error: "This license number is already registered" }, { status: 400 })
                }
            } else {
                return NextResponse.json({ error: "Invalid registration type" }, { status: 400 })
            }

            const email = validatedData.email.toLowerCase()

            // Check if user already exists
            const existingUser = await prisma.user.findUnique({ where: { email } })
            if (existingUser) {
                return NextResponse.json({ error: "An account with this email already exists" }, { status: 400 })
            }

            // Generate 6-digit OTP
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
            const expires = new Date()
            expires.setMinutes(expires.getMinutes() + 10) // 10 minutes expiry

            // Save to DB (upsert so we can resend)
            await prisma.verificationToken.upsert({
                where: {
                    identifier_token: {
                        identifier: email,
                        token: otpCode // we will delete old tokens by identifier below
                    }
                },
                update: { token: otpCode, expires },
                create: { identifier: email, token: otpCode, expires }
            }).catch(async () => {
                // If the compound unique constraint fails, it means we have old tokens. Let's delete them.
                await prisma.verificationToken.deleteMany({ where: { identifier: email } })
                await prisma.verificationToken.create({ data: { identifier: email, token: otpCode, expires } })
            })

            // Send OTP
            await sendOTPEmail(email, otpCode)

            return NextResponse.json({
                success: true,
                message: "OTP sent to your email address.",
            })
        }

        if (action === "verify-otp") {
            if (!otp) {
                return NextResponse.json({ error: "OTP is required" }, { status: 400 })
            }

            let validatedData;
            if (type === "patient") {
                validatedData = patientRegistrationSchema.parse(body);
            } else if (type === "doctor") {
                validatedData = doctorRegistrationSchema.parse(body);
            } else {
                return NextResponse.json({ error: "Invalid registration type" }, { status: 400 })
            }

            const email = validatedData.email.toLowerCase()

            // Verify OTP
            const verificationRecord = await prisma.verificationToken.findFirst({
                where: {
                    identifier: email,
                    token: otp
                }
            })

            if (!verificationRecord) {
                return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 })
            }

            if (verificationRecord.expires < new Date()) {
                // Delete expired token
                await prisma.verificationToken.delete({ where: { identifier_token: { identifier: email, token: otp } } })
                return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 })
            }

            // Hash password
            const passwordHash = await bcrypt.hash(validatedData.password, 12)

            let userId = "";

            if (type === "patient") {
                const patientData = validatedData as z.infer<typeof patientRegistrationSchema>;
                const user = await prisma.$transaction(async (tx) => {
                    const newUser = await tx.user.create({
                        data: {
                            email: email,
                            emailVerified: new Date(),
                            passwordHash,
                            name: patientData.name,
                            phoneNumber: patientData.phoneNumber,
                            role: UserRole.PATIENT,
                        }
                    })

                    await tx.patient.create({
                        data: {
                            userId: newUser.id,
                            regionCode: patientData.regionCode,
                            consentSignedAt: new Date(),
                            consentVersion: "1.0",
                        }
                    })

                    await tx.accessLog.create({
                        data: {
                            userId: newUser.id,
                            action: "REGISTER",
                            resourceType: "ACCOUNT",
                            metadata: { type: "patient", region: patientData.regionCode }
                        }
                    })

                    return newUser
                })
                userId = user.id;

            } else if (type === "doctor") {
                const doctorData = validatedData as z.infer<typeof doctorRegistrationSchema>;
                const user = await prisma.$transaction(async (tx) => {
                    const newUser = await tx.user.create({
                        data: {
                            email: email,
                            emailVerified: new Date(),
                            passwordHash,
                            name: doctorData.name,
                            phoneNumber: doctorData.phoneNumber,
                            role: UserRole.DOCTOR,
                        }
                    })

                    await tx.doctor.create({
                        data: {
                            userId: newUser.id,
                            licenseNumber: doctorData.licenseNumber,
                            licenseExpiry: new Date(doctorData.licenseExpiry),
                            specialty: doctorData.specialty,
                            assignedRegions: doctorData.assignedRegions,
                            // Verification status stays PENDING - requires admin approval
                        }
                    })

                    await tx.accessLog.create({
                        data: {
                            userId: newUser.id,
                            action: "REGISTER",
                            resourceType: "ACCOUNT",
                            metadata: {
                                type: "doctor",
                                license: doctorData.licenseNumber,
                                specialty: doctorData.specialty
                            }
                        }
                    })

                    return newUser
                })
                userId = user.id;
            }

            // Cleanup OTP token
            await prisma.verificationToken.deleteMany({ where: { identifier: email } })

            const message = type === "patient" 
                ? "Registration successful. You can now sign in." 
                : "Registration successful. Your credentials will be verified by an administrator before full access.";

            return NextResponse.json({
                success: true,
                message,
                userId
            })
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 })

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: (error as any).errors[0].message },
                { status: 400 }
            )
        }

        console.error("Registration error:", error)
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        )
    }
}
