import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { sendResultEmail } from "@/lib/email"

const reviewSchema = z.object({
    biradsClassification: z.number().min(0).max(6),
    clinicalNotes: z.string().optional(),
    recommendation: z.enum([
        "ROUTINE_SCREENING",
        "SHORT_TERM_FOLLOWUP",
        "ADDITIONAL_IMAGING",
        "BIOPSY_RECOMMENDED",
        "IMMEDIATE_REFERRAL"
    ]),
    aiAgreement: z.enum(["AGREE", "PARTIAL", "DISAGREE"]).nullable().optional(),
    aiInferenceId: z.string().optional(),
})

// Patient-friendly message templates based on BI-RADS and recommendation
const PATIENT_MESSAGES: Record<string, { summary: string; recommendation: string }> = {
    "1_ROUTINE_SCREENING": {
        summary: "Your screening results look reassuring. No concerning findings were identified in your mammogram images.",
        recommendation: "Continue with your regular screening schedule as recommended by your healthcare provider. Maintaining regular screenings is an important part of breast health."
    },
    "2_ROUTINE_SCREENING": {
        summary: "Your screening results show some normal breast tissue variations that are not concerning. These are common and benign findings.",
        recommendation: "Continue with your regular screening schedule. No additional follow-up is needed at this time."
    },
    "3_SHORT_TERM_FOLLOWUP": {
        summary: "Your screening results show an area that appears likely to be benign. This type of finding is very common and usually turns out to be nothing concerning.",
        recommendation: "We recommend a follow-up mammogram in 6 months to confirm stability. This is a precautionary measure and is not cause for alarm."
    },
    "0_ADDITIONAL_IMAGING": {
        summary: "Your screening images need some additional views to provide a complete assessment. This is a routine part of the screening process.",
        recommendation: "Please schedule additional imaging at your earliest convenience. This will help ensure we have the clearest possible picture."
    },
    "4_BIOPSY_RECOMMENDED": {
        summary: "Your screening results show an area that we would like to examine more closely. Many findings like this turn out to be benign after further evaluation.",
        recommendation: "We recommend scheduling a follow-up appointment with your healthcare provider to discuss next steps. Please contact your doctor's office to arrange this."
    },
    "5_IMMEDIATE_REFERRAL": {
        summary: "Your screening results show an area that requires prompt attention from your healthcare team.",
        recommendation: "Please contact your healthcare provider as soon as possible to discuss your results and next steps. They will guide you through the recommended follow-up process."
    },
}

function getPatientMessage(birads: number, recommendation: string): { summary: string; recommendation: string } {
    const key = `${birads}_${recommendation}`

    // Try exact match first
    if (PATIENT_MESSAGES[key]) {
        return PATIENT_MESSAGES[key]
    }

    // Fallback based on recommendation type
    const fallbacks: Record<string, { summary: string; recommendation: string }> = {
        "ROUTINE_SCREENING": {
            summary: "Your screening results have been reviewed by a qualified specialist.",
            recommendation: "Continue with your regular screening schedule as recommended by your healthcare provider."
        },
        "SHORT_TERM_FOLLOWUP": {
            summary: "Your screening results have been reviewed. A follow-up is recommended.",
            recommendation: "Please schedule a follow-up mammogram as recommended by your healthcare team."
        },
        "ADDITIONAL_IMAGING": {
            summary: "Additional imaging is recommended to complete your screening evaluation.",
            recommendation: "Please schedule additional imaging at your earliest convenience."
        },
        "BIOPSY_RECOMMENDED": {
            summary: "Your results have been reviewed and further evaluation is recommended.",
            recommendation: "Please contact your healthcare provider to discuss next steps and schedule a follow-up appointment."
        },
        "IMMEDIATE_REFERRAL": {
            summary: "Your results require attention from your healthcare team.",
            recommendation: "Please contact your healthcare provider promptly to discuss your results."
        },
    }

    return fallbacks[recommendation] || fallbacks["ROUTINE_SCREENING"]
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ caseId: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "DOCTOR") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { caseId } = await params

        const doctor = await prisma.doctor.findUnique({
            where: { userId: session.user.id }
        })

        if (!doctor || doctor.verificationStatus !== "VERIFIED") {
            return NextResponse.json({ error: "Doctor not verified" }, { status: 403 })
        }

        const body = await request.json()
        const validatedData = reviewSchema.parse(body)

        // Verify case exists and is assigned to this doctor
        const caseData = await prisma.case.findUnique({
            where: { id: caseId },
            include: { patient: { include: { user: true } } }
        })

        if (!caseData) {
            return NextResponse.json({ error: "Case not found" }, { status: 404 })
        }

        if (caseData.assignedDoctorId !== doctor.id) {
            // Allow if doctor is in the region
            if (!doctor.assignedRegions.includes(caseData.regionCode)) {
                return NextResponse.json({ error: "Access denied" }, { status: 403 })
            }
        }

        // Create review and update case in transaction
        const result = await prisma.$transaction(async (tx: any) => {
            // Create the doctor review
            const review = await tx.doctorReview.create({
                data: {
                    caseId,
                    doctorId: doctor.id,
                    biradsClassification: validatedData.biradsClassification,
                    clinicalNotes: validatedData.clinicalNotes,
                    recommendation: validatedData.recommendation,
                    aiInferenceId: validatedData.aiInferenceId,
                    aiAgreement: validatedData.aiAgreement,
                    reviewStartedAt: caseData.assignedAt,
                }
            })

            // If there was an AI inference, mark it as shown to doctor
            if (validatedData.aiInferenceId) {
                await tx.aIInference.update({
                    where: { id: validatedData.aiInferenceId },
                    data: { shownToDoctor: true }
                })

                // Log the model decision for audit
                const aiInference = await tx.aIInference.findUnique({
                    where: { id: validatedData.aiInferenceId }
                })

                if (aiInference) {
                    await tx.modelDecisionLog.create({
                        data: {
                            aiInferenceId: validatedData.aiInferenceId,
                            inputHash: caseId, // Simplified - in production use actual image hash
                            outputJson: {
                                riskTier: aiInference.riskTier,
                                doctorBirads: validatedData.biradsClassification,
                                agreement: validatedData.aiAgreement,
                            },
                            doctorOverride: validatedData.aiAgreement === "DISAGREE",
                        }
                    })
                }
            }

            // Generate patient communication
            const patientMessage = getPatientMessage(
                validatedData.biradsClassification,
                validatedData.recommendation
            )

            const communication = await tx.patientCommunication.create({
                data: {
                    caseId,
                    summaryText: patientMessage.summary,
                    recommendationText: patientMessage.recommendation,
                    approvedByDoctorId: doctor.id,
                    approvedAt: new Date(),
                    sentToPatient: true,
                    sentAt: new Date(),
                }
            })

            // Update case status to reviewed
            await tx.case.update({
                where: { id: caseId },
                data: { status: "REVIEWED" }
            })

            // Make mandatory chat sessions non-mandatory now that review is complete
            await tx.chatSession.updateMany({
                where: {
                    caseId,
                    isMandatory: true,
                },
                data: {
                    isMandatory: false,
                },
            })

            // Log the review action
            await tx.accessLog.create({
                data: {
                    userId: session.user.id,
                    action: "SUBMIT_REVIEW",
                    resourceType: "CASE",
                    resourceId: caseId,
                    metadata: {
                        birads: validatedData.biradsClassification,
                        recommendation: validatedData.recommendation,
                        aiAgreement: validatedData.aiAgreement,
                    }
                }
            })

            return { review, communication }
        })

        // SEND EMAIL HERE
        const doctorName = session.user.name || "Specialist";
        const patientName = caseData.patient.user.name || "Patient";
        const patientEmail = caseData.patient.user.email;
        
        try {
            if (patientEmail) {
                await sendResultEmail(
                    patientEmail,
                    patientName,
                    result.communication.summaryText,
                    result.communication.recommendationText,
                    doctorName,
                    result.review.biradsClassification,
                    result.review.clinicalNotes || ""
                );
            }
        } catch (emailError) {
            console.error("Failed to send result email to patient, continuing anyway:", emailError);
        }

        return NextResponse.json({
            success: true,
            reviewId: result.review.id,
            communicationId: result.communication.id,
            message: "Review submitted successfully",
        })

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: error.issues[0].message },
                { status: 400 }
            )
        }

        console.error("Review submission error:", error)
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        )
    }
}
