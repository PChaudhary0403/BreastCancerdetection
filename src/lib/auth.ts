import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { UserRole } from "@prisma/client"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            email: string
            name?: string | null
            role: UserRole
            accountStatus: string
        }
    }

    interface User {
        id: string
        email: string
        name?: string | null
        role: UserRole
        accountStatus: string
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string
        role: UserRole
        accountStatus: string
    }
}

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],

    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
            allowDangerousEmailAccountLinking: true,
            profile(profile) {
                return {
                    id: profile.sub,
                    name: profile.name,
                    email: profile.email,
                    role: "PATIENT",
                    accountStatus: "ACTIVE",
                }
            }
        }),
        CredentialsProvider({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Email and password are required")
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email.toLowerCase() }
                })

                if (!user || !user.passwordHash) {
                    throw new Error("Invalid email or password")
                }

                if (user.accountStatus !== "ACTIVE") {
                    throw new Error("Account is suspended or deleted")
                }

                // Mandatory Email Verification for NEW Users
                // Cutoff date ensures we "keep the previous users as it is"
                const CUTOFF_DATE = new Date("2026-04-12T00:00:00Z")
                if (!user.emailVerified && user.createdAt > CUTOFF_DATE) {
                    throw new Error("Please verify your email address to continue. Check your inbox.")
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password,
                    user.passwordHash
                )

                if (!isPasswordValid) {
                    throw new Error("Invalid email or password")
                }

                // Update last login
                await prisma.user.update({
                    where: { id: user.id },
                    data: { lastLoginAt: new Date() }
                })

                // Log successful login
                await prisma.accessLog.create({
                    data: {
                        userId: user.id,
                        action: "LOGIN",
                        resourceType: "SESSION",
                        metadata: { method: "credentials" }
                    }
                })

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    accountStatus: user.accountStatus
                }
            }
        })
    ],

    session: {
        strategy: "jwt",
        maxAge: 30 * 60, // 30 minutes - security requirement for medical data
    },

    pages: {
        signIn: "/auth/login",
        error: "/auth/error",
    },

    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.role = user.role
                token.accountStatus = user.accountStatus
            }
            return token
        },

        async session({ session, token }) {
            if (token) {
                session.user.id = token.id
                session.user.role = token.role
                session.user.accountStatus = token.accountStatus
            }
            return session
        },

        async signIn({ user }) {
            // Additional security checks can be added here
            // For doctors, verify license is still valid
            if (user.role === "DOCTOR") {
                const doctor = await prisma.doctor.findUnique({
                    where: { userId: user.id }
                })

                if (doctor) {
                    if (doctor.verificationStatus !== "VERIFIED") {
                        throw new Error("Doctor account not verified")
                    }
                    if (doctor.licenseExpiry < new Date()) {
                        throw new Error("Medical license has expired")
                    }
                }
            }

            return true
        }
    },

    events: {
        async createUser({ user }) {
            // Check if user has a patient record. NextAuth adapter might just create the User.
            // If the user signed up via Google, they'll default to PATIENT role. We need to create the Patient profile.
            if (user.role === "PATIENT") {
                const existingPatient = await prisma.patient.findUnique({
                    where: { userId: user.id }
                })
                if (!existingPatient) {
                    await prisma.patient.create({
                        data: {
                            userId: user.id,
                            regionCode: "UNKNOWN", // Default for Google Signups
                            consentSignedAt: new Date(),
                            consentVersion: "1.0",
                        }
                    })
                }
            }
        },
        async signOut({ token }) {
            if (token?.id) {
                await prisma.accessLog.create({
                    data: {
                        userId: token.id as string,
                        action: "LOGOUT",
                        resourceType: "SESSION"
                    }
                })
            }
        }
    },

    debug: process.env.NODE_ENV === "development",
}
