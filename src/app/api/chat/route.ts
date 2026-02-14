import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET: Fetch all chat sessions for the current user
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { role } = session.user

        if (role === "DOCTOR") {
            const doctor = await prisma.doctor.findUnique({
                where: { userId: session.user.id },
            })
            if (!doctor) {
                return NextResponse.json({ error: "Doctor not found" }, { status: 404 })
            }

            const chatSessions = await prisma.chatSession.findMany({
                where: { doctorId: doctor.id },
                include: {
                    case: { select: { id: true, status: true, regionCode: true } },
                    patient: {
                        select: {
                            id: true,
                            pseudonymId: true,
                            user: { select: { name: true } }
                        }
                    },
                    messages: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                    },
                    _count: {
                        select: {
                            messages: {
                                where: {
                                    senderRole: "PATIENT",
                                    isRead: false,
                                },
                            },
                        },
                    },
                },
                orderBy: { updatedAt: "desc" },
            })

            return NextResponse.json({ sessions: chatSessions })
        }

        if (role === "PATIENT") {
            const patient = await prisma.patient.findUnique({
                where: { userId: session.user.id },
            })
            if (!patient) {
                return NextResponse.json({ error: "Patient not found" }, { status: 404 })
            }

            const chatSessions = await prisma.chatSession.findMany({
                where: { patientId: patient.id },
                include: {
                    case: { select: { id: true, status: true, regionCode: true } },
                    doctor: {
                        select: {
                            id: true,
                            specialty: true,
                            user: { select: { name: true } }
                        }
                    },
                    messages: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                    },
                    _count: {
                        select: {
                            messages: {
                                where: {
                                    senderRole: "DOCTOR",
                                    isRead: false,
                                },
                            },
                        },
                    },
                },
                orderBy: { updatedAt: "desc" },
            })

            return NextResponse.json({ sessions: chatSessions })
        }

        return NextResponse.json({ error: "Invalid role" }, { status: 403 })
    } catch (error) {
        console.error("Error fetching chat sessions:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST: Create a new chat session (doctor-initiated or auto-created)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { caseId } = body

        if (!caseId) {
            return NextResponse.json({ error: "caseId is required" }, { status: 400 })
        }

        // Fetch the case to get patient and doctor info
        const caseData = await prisma.case.findUnique({
            where: { id: caseId },
            include: { patient: true },
        })

        if (!caseData) {
            return NextResponse.json({ error: "Case not found" }, { status: 404 })
        }

        // Determine doctorId
        let doctorId = caseData.assignedDoctorId
        if (!doctorId) {
            // If doctor is creating the session, use their doctor ID
            if (session.user.role === "DOCTOR") {
                const doctor = await prisma.doctor.findUnique({
                    where: { userId: session.user.id },
                })
                if (!doctor) {
                    return NextResponse.json({ error: "Doctor not found" }, { status: 404 })
                }
                doctorId = doctor.id
            } else {
                return NextResponse.json({ error: "No doctor assigned to this case" }, { status: 400 })
            }
        }

        // Check if a session already exists
        const existingSession = await prisma.chatSession.findUnique({
            where: {
                caseId_doctorId_patientId: {
                    caseId,
                    doctorId,
                    patientId: caseData.patientId,
                },
            },
            include: {
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
        })

        if (existingSession) {
            // If session was closed by doctor but case is still active, reopen
            if (existingSession.status === "CLOSED" &&
                ["PENDING_REVIEW", "UNDER_REVIEW"].includes(caseData.status)) {
                const reopened = await prisma.chatSession.update({
                    where: { id: existingSession.id },
                    data: {
                        status: "ACTIVE",
                        isMandatory: true,
                        closedAt: null,
                        closedByDoctorAt: null,
                    },
                })
                return NextResponse.json({ session: reopened, created: false, reopened: true })
            }
            return NextResponse.json({ session: existingSession, created: false })
        }

        // Determine if mandatory (case is in active screening)
        const isMandatory = ["PENDING_REVIEW", "UNDER_REVIEW"].includes(caseData.status)

        const chatSession = await prisma.chatSession.create({
            data: {
                caseId,
                patientId: caseData.patientId,
                doctorId,
                isMandatory,
                status: "ACTIVE",
            },
        })

        return NextResponse.json({ session: chatSession, created: true })
    } catch (error) {
        console.error("Error creating chat session:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
