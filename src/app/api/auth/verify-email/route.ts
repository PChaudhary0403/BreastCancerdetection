import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { token } = body

        if (!token) {
            return NextResponse.json(
                { error: "Verification token is required" },
                { status: 400 }
            )
        }

        const verificationToken = await prisma.verificationToken.findFirst({
            where: { token }
        })

        if (!verificationToken) {
            return NextResponse.json(
                { error: "Invalid verification token" },
                { status: 400 }
            )
        }

        if (verificationToken.expires < new Date()) {
            return NextResponse.json(
                { error: "Token has expired" },
                { status: 400 }
            )
        }

        // Verify the user
        await prisma.user.update({
            where: { email: verificationToken.identifier },
            data: { emailVerified: new Date() }
        })

        // Delete the token
        await prisma.verificationToken.delete({
            where: {
                identifier_token: {
                    identifier: verificationToken.identifier,
                    token: verificationToken.token
                }
            }
        })

        return NextResponse.json({
            success: true,
            message: "Email verified successfully!"
        })

    } catch (error) {
        console.error("Verification error:", error)
        return NextResponse.json(
            { error: "An unexpected error occurred during verification" },
            { status: 500 }
        )
    }
}
