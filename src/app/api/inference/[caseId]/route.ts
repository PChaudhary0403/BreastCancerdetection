import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { runBatchInference, checkMLServiceHealth } from "@/lib/ml-service"

/**
 * Trigger ML inference for a case
 * 
 * IMPORTANT: AI predictions are ADVISORY ONLY
 * All results must be reviewed and confirmed by qualified doctors
 */
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

        // Verify doctor is verified
        const doctor = await prisma.doctor.findUnique({
            where: { userId: session.user.id }
        })

        if (!doctor || doctor.verificationStatus !== "VERIFIED") {
            return NextResponse.json({ error: "Doctor not verified" }, { status: 403 })
        }

        // Get case with images
        const caseData = await prisma.case.findUnique({
            where: { id: caseId },
            include: { images: true }
        })

        if (!caseData) {
            return NextResponse.json({ error: "Case not found" }, { status: 404 })
        }

        // Verify doctor has access
        const isAssigned = caseData.assignedDoctorId === doctor.id
        const isInRegion = doctor.assignedRegions.includes(caseData.regionCode)

        if (!isAssigned && !isInRegion) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        // Check if ML service is available
        const health = await checkMLServiceHealth()

        if (health.status !== "healthy" || !health.model_loaded) {
            return NextResponse.json({
                error: "ML service is currently unavailable",
                details: "The AI analysis service is not ready. Please try again later or proceed with manual review."
            }, { status: 503 })
        }

        // Get image storage references
        const imageRefs = caseData.images.map(img => img.storageReference)

        if (imageRefs.length === 0) {
            return NextResponse.json({ error: "No images found for this case" }, { status: 400 })
        }

        // Run batch inference
        const result = await runBatchInference(imageRefs, caseId)

        if (!result) {
            return NextResponse.json({
                error: "AI analysis failed",
                details: "Unable to process the images. Please proceed with manual review."
            }, { status: 500 })
        }

        // Store inference results
        const storedInferences = []

        for (const inference of result.inferences) {
            const stored = await prisma.aIInference.create({
                data: {
                    caseId,
                    modelVersion: inference.model_version,
                    riskTier: inference.risk_tier,
                    attentionMapReference: inference.attention_map_reference,
                    rawOutputJson: {
                        birads_prediction: inference.birads_prediction,
                        birads_probabilities: inference.birads_probabilities,
                        confidence: inference.confidence,
                        malignancy_probability: inference.malignancy_probability,
                        lesion_probability: inference.lesion_probability,
                    },
                    shownToDoctor: false, // Will be marked true when doctor views
                }
            })
            storedInferences.push(stored)
        }

        // Log the inference request
        await prisma.accessLog.create({
            data: {
                userId: session.user.id,
                action: "REQUEST_AI_INFERENCE",
                resourceType: "CASE",
                resourceId: caseId,
                metadata: {
                    imagesProcessed: imageRefs.length,
                    aggregatedRiskTier: result.aggregatedRiskTier,
                    modelVersion: health.model_version,
                }
            }
        })

        return NextResponse.json({
            success: true,
            message: "AI analysis completed successfully",
            advisory_notice: "AI predictions are for advisory purposes only. Your clinical judgment is the final authority.",
            results: {
                aggregatedRiskTier: result.aggregatedRiskTier,
                highestBirads: result.highestBirads,
                averageConfidence: result.averageConfidence,
                inferenceCount: storedInferences.length,
                modelVersion: health.model_version,
            }
        })

    } catch (error) {
        console.error("ML inference error:", error)
        return NextResponse.json(
            { error: "An unexpected error occurred during analysis" },
            { status: 500 }
        )
    }
}

/**
 * Get existing inference results for a case
 */
export async function GET(
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

        // Get inferences for this case
        const inferences = await prisma.aIInference.findMany({
            where: { caseId },
            orderBy: { inferenceTimestamp: "desc" }
        })

        return NextResponse.json({
            success: true,
            inferences: inferences.map(inf => ({
                id: inf.id,
                riskTier: inf.riskTier,
                modelVersion: inf.modelVersion,
                timestamp: inf.inferenceTimestamp,
                attentionMapReference: inf.attentionMapReference,
                shownToDoctor: inf.shownToDoctor,
            })),
            advisory_notice: "AI predictions are for advisory purposes only."
        })

    } catch (error) {
        console.error("Get inference error:", error)
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        )
    }
}
