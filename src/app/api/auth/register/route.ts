import { z } from "zod"
import bcrypt from "bcryptjs"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import crypto from "crypto"
import { sendVerificationEmail } from "@/lib/email"
// Registration schema with validation
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
        const { type } = body

        if (type === "patient") {
            const validatedData = patientRegistrationSchema.parse(body)

            // Check if user already exists
            const existingUser = await prisma.user.findUnique({
                where: { email: validatedData.email.toLowerCase() }
            })

            if (existingUser) {
                return NextResponse.json(
                    { error: "An account with this email already exists" },
                    { status: 400 }
                )
            }

            // Hash password
            const passwordHash = await bcrypt.hash(validatedData.password, 12)

            // Create user and patient in transaction
            const user = await prisma.$transaction(async (tx) => {
                const newUser = await tx.user.create({
                    data: {
                        email: validatedData.email.toLowerCase(),
                        passwordHash,
                        name: validatedData.name,
                        phoneNumber: validatedData.phoneNumber,
                        role: UserRole.PATIENT,
                    }
                })

                await tx.patient.create({
                    data: {
                        userId: newUser.id,
                        regionCode: validatedData.regionCode,
                        consentSignedAt: new Date(),
                        consentVersion: "1.0",
                    }
                })

                // Log registration
                await tx.accessLog.create({
                    data: {
                        userId: newUser.id,
                        action: "REGISTER",
                        resourceType: "ACCOUNT",
                        metadata: { type: "patient", region: validatedData.regionCode }
                    }
                })

                return newUser
            })

            // Generate verification token
            const token = crypto.randomBytes(32).toString('hex')
            const expires = new Date()
            expires.setHours(expires.getHours() + 24) // 24 hours from now

            await prisma.verificationToken.create({
                data: {
                    identifier: user.email,
                    token,
                    expires
                }
            })

            // Send verification email (non-blocking)
            sendVerificationEmail(user.email, token).catch(e => console.error("Email error:", e))

            return NextResponse.json({
                success: true,
                message: "Registration successful. Please check your inbox to verify your email.",
                userId: user.id
            })

        } else if (type === "doctor") {
            const validatedData = doctorRegistrationSchema.parse(body)

            // Check if user already exists
            const existingUser = await prisma.user.findUnique({
                where: { email: validatedData.email.toLowerCase() }
            })

            if (existingUser) {
                return NextResponse.json(
                    { error: "An account with this email already exists" },
                    { status: 400 }
                )
            }

            // Check if license number already registered
            const existingDoctor = await prisma.doctor.findUnique({
                where: { licenseNumber: validatedData.licenseNumber }
            })

            if (existingDoctor) {
                return NextResponse.json(
                    { error: "This license number is already registered" },
                    { status: 400 }
                )
            }

            // Hash password
            const passwordHash = await bcrypt.hash(validatedData.password, 12)

            // Create user and doctor in transaction
            const user = await prisma.$transaction(async (tx) => {
                const newUser = await tx.user.create({
                    data: {
                        email: validatedData.email.toLowerCase(),
                        passwordHash,
                        name: validatedData.name,
                        phoneNumber: validatedData.phoneNumber,
                        role: UserRole.DOCTOR,
                    }
                })

                await tx.doctor.create({
                    data: {
                        userId: newUser.id,
                        licenseNumber: validatedData.licenseNumber,
                        licenseExpiry: new Date(validatedData.licenseExpiry),
                        specialty: validatedData.specialty,
                        assignedRegions: validatedData.assignedRegions,
                        // Verification status stays PENDING - requires admin approval
                    }
                })

                // Log registration
                await tx.accessLog.create({
                    data: {
                        userId: newUser.id,
                        action: "REGISTER",
                        resourceType: "ACCOUNT",
                        metadata: {
                            type: "doctor",
                            license: validatedData.licenseNumber,
                            specialty: validatedData.specialty
                        }
                    }
                })

                return newUser
            })

            return NextResponse.json({
                success: true,
                message: "Registration submitted. Your credentials will be verified by an administrator.",
                userId: user.id
            })

        } else {
            return NextResponse.json(
                { error: "Invalid registration type" },
                { status: 400 }
            )
        }

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
