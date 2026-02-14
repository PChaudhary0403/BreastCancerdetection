import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET: Fetch messages for a specific chat session
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { sessionId } = await params
        const url = new URL(request.url)
        const cursor = url.searchParams.get("cursor")
        const limit = parseInt(url.searchParams.get("limit") || "50")

        // Verify user has access to this session
        const chatSession = await prisma.chatSession.findUnique({
            where: { id: sessionId },
            include: {
                patient: { select: { userId: true } },
                doctor: { select: { userId: true } },
            },
        })

        if (!chatSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 })
        }

        const isPatient = chatSession.patient.userId === session.user.id
        const isDoctor = chatSession.doctor.userId === session.user.id

        if (!isPatient && !isDoctor) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const messages = await prisma.chatMessage.findMany({
            where: { sessionId },
            orderBy: { createdAt: "asc" },
            take: limit,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        })

        return NextResponse.json({
            messages,
            session: {
                id: chatSession.id,
                status: chatSession.status,
                isMandatory: chatSession.isMandatory,
                caseId: chatSession.caseId,
            },
        })
    } catch (error) {
        console.error("Error fetching messages:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// PATCH: Update chat session (close/reopen)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "DOCTOR") {
            return NextResponse.json({ error: "Only doctors can manage sessions" }, { status: 403 })
        }

        const { sessionId } = await params
        const body = await request.json()
        const { action } = body // "close" or "reopen"

        const chatSession = await prisma.chatSession.findUnique({
            where: { id: sessionId },
            include: {
                case: true,
                doctor: { select: { userId: true } },
            },
        })

        if (!chatSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 })
        }

        if (chatSession.doctor.userId !== session.user.id) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        if (action === "close") {
            // Check if mandatory (during active screening)
            if (chatSession.isMandatory &&
                ["PENDING_REVIEW", "UNDER_REVIEW"].includes(chatSession.case.status)) {
                return NextResponse.json({
                    error: "Cannot close communication during active screening. Complete the review first.",
                }, { status: 400 })
            }

            const updated = await prisma.chatSession.update({
                where: { id: sessionId },
                data: {
                    status: "CLOSED",
                    closedAt: new Date(),
                    closedByDoctorAt: new Date(),
                },
            })

            return NextResponse.json({ session: updated })
        }

        if (action === "reopen") {
            const updated = await prisma.chatSession.update({
                where: { id: sessionId },
                data: {
                    status: "ACTIVE",
                    closedAt: null,
                    closedByDoctorAt: null,
                },
            })

            return NextResponse.json({ session: updated })
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    } catch (error) {
        console.error("Error updating session:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
