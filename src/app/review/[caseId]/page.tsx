import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import ReviewInterface from "./review-interface"

interface PageProps {
    params: Promise<{ caseId: string }>
}

export default async function  ReviewPage({ params }: PageProps) {
    const session = await getServerSession(authOptions)
    const { caseId } = await params

    if (!session || session.user.role !== "DOCTOR") {
        redirect("/auth/login")
    }

    const doctor = await prisma.doctor.findUnique({
        where: { userId: session.user.id }
    })

    if (!doctor || doctor.verificationStatus !== "VERIFIED") {
        redirect("/dashboard/doctor")
    }

    // Fetch case data
    const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
            images: true,
            patient: {
                select: {
                    regionCode: true,
                    pseudonymId: true,
                }
            },
            doctorReviews: {
                where: { doctorId: doctor.id },
                orderBy: { reviewCompletedAt: "desc" },
                take: 1,
            },
            aiInferences: {
                orderBy: { inferenceTimestamp: "desc" },
                take: 1,
            },
        }
    })

    if (!caseData) {
        notFound()
    }

    // Check authorization
    const isAssigned = caseData.assignedDoctorId === doctor.id
    const isInRegion = doctor.assignedRegions.includes(caseData.regionCode)

    if (!isAssigned && !isInRegion) {
        redirect("/dashboard/doctor")
    }

    // Update case status to under review if pending
    if (caseData.status === "PENDING_REVIEW") {
        await prisma.case.update({
            where: { id: caseId },
            data: {
                status: "UNDER_REVIEW",
                assignedDoctorId: doctor.id,
                assignedAt: new Date(),
            }
        })

        // Auto-create mandatory chat session for screening period
        const existingChatSession = await prisma.chatSession.findUnique({
            where: {
                caseId_doctorId_patientId: {
                    caseId,
                    doctorId: doctor.id,
                    patientId: caseData.patientId,
                },
            },
        })

        if (!existingChatSession) {
            await prisma.chatSession.create({
                data: {
                    caseId,
                    patientId: caseData.patientId,
                    doctorId: doctor.id,
                    isMandatory: true,
                    status: "ACTIVE",
                },
            })
        } else if (existingChatSession.status === "CLOSED") {
            // Reopen if it was closed
            await prisma.chatSession.update({
                where: { id: existingChatSession.id },
                data: {
                    status: "ACTIVE",
                    isMandatory: true,
                    closedAt: null,
                    closedByDoctorAt: null,
                },
            })
        }
    }

    // Log access
    await prisma.dataAccessLog.create({
        data: {
            accessorId: doctor.id,
            accessorType: "DOCTOR",
            caseId: caseData.id,
            accessType: "VIEW",
            justification: "Case review",
        }
    })

    const existingReview = caseData.doctorReviews[0] || null
    const aiInference = caseData.aiInferences[0] || null

    return (
        <ReviewInterface
            caseData={{
                id: caseData.id,
                status: caseData.status,
                regionCode: caseData.regionCode,
                createdAt: caseData.createdAt.toISOString(),
                patientPseudonymId: caseData.patient.pseudonymId,
                images: caseData.images.map((img: { id: string; viewPosition: string | null; laterality: string | null; storageReference: string }) => ({
                    id: img.id,
                    viewPosition: img.viewPosition,
                    laterality: img.laterality,
                    storageReference: img.storageReference,
                })),
            }}
            existingReview={existingReview ? {
                id: existingReview.id,
                biradsClassification: existingReview.biradsClassification,
                clinicalNotes: existingReview.clinicalNotes,
                recommendation: existingReview.recommendation,
                aiAgreement: existingReview.aiAgreement,
            } : null}
            aiInference={aiInference ? {
                id: aiInference.id,
                riskTier: aiInference.riskTier,
                attentionMapReference: aiInference.attentionMapReference,
                shownToDoctor: aiInference.shownToDoctor,
            } : null}
            doctorId={doctor.id}
            doctorName={session.user.name || "Doctor"}
        />
    )
}
