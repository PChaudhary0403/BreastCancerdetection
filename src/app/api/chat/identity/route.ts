import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET: Returns the doctor/patient entity ID for the current user
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        if (session.user.role === "DOCTOR") {
            const doctor = await prisma.doctor.findUnique({
                where: { userId: session.user.id },
                select: { id: true },
            })
            if (!doctor) {
                return NextResponse.json({ error: "Doctor record not found" }, { status: 404 })
            }
            return NextResponse.json({ entityId: doctor.id, role: "DOCTOR" })
        }

        if (session.user.role === "PATIENT") {
            const patient = await prisma.patient.findUnique({
                where: { userId: session.user.id },
                select: { id: true },
            })
            if (!patient) {
                return NextResponse.json({ error: "Patient record not found" }, { status: 404 })
            }
            return NextResponse.json({ entityId: patient.id, role: "PATIENT" })
        }

        return NextResponse.json({ error: "Invalid role for chat" }, { status: 403 })
    } catch (error) {
        console.error("Error fetching chat identity:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
