import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET /api/cases/reports
 * 
 * Fetches completed case reports for the logged-in doctor
 * with AI inference details for progress bar visualization.
 * 
 * Query params:
 *   - days: number of days to look back (default: 30)
 *   - limit: max results (default: 50)
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session || session.user.role !== "DOCTOR") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const doctor = await prisma.doctor.findUnique({
            where: { userId: session.user.id },
        })

        if (!doctor || doctor.verificationStatus !== "VERIFIED") {
            return NextResponse.json({ error: "Doctor not verified" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const days = parseInt(searchParams.get("days") || "30", 10)
        const limit = parseInt(searchParams.get("limit") || "50", 10)

        const sinceDate = new Date()
        sinceDate.setDate(sinceDate.getDate() - days)

        // Fetch completed reviews by this doctor
        const reviews = await prisma.doctorReview.findMany({
            where: {
                doctorId: doctor.id,
                reviewCompletedAt: { gte: sinceDate },
            },
            orderBy: { reviewCompletedAt: "desc" },
            take: Math.min(limit, 100),
            include: {
                case: {
                    select: {
                        id: true,
                        regionCode: true,
                        status: true,
                        createdAt: true,
                        images: {
                            select: { id: true, laterality: true, viewPosition: true },
                        },
                    },
                },
                aiInference: {
                    select: {
                        id: true,
                        riskTier: true,
                        modelVersion: true,
                        rawOutputJson: true,
                        inferenceTimestamp: true,
                    },
                },
            },
        })

        // Transform data for the frontend
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reports = reviews.map((review: any) => {
            const rawOutput = review.aiInference?.rawOutputJson as Record<string, unknown> | null

            return {
                reviewId: review.id,
                caseId: review.caseId,
                regionCode: review.case.regionCode,
                caseStatus: review.case.status,
                caseCreatedAt: review.case.createdAt.toISOString(),
                imageCount: review.case.images.length,
                images: review.case.images,

                // Doctor's assessment
                biradsClassification: review.biradsClassification,
                recommendation: review.recommendation,
                clinicalNotes: review.clinicalNotes,
                aiAgreement: review.aiAgreement,
                reviewCompletedAt: review.reviewCompletedAt.toISOString(),
                reviewStartedAt: review.reviewStartedAt?.toISOString() || null,

                // AI inference metrics (for progress bars)
                aiInference: review.aiInference
                    ? {
                          id: review.aiInference.id,
                          riskTier: review.aiInference.riskTier,
                          modelVersion: review.aiInference.modelVersion,
                          inferenceTimestamp: review.aiInference.inferenceTimestamp,
                          confidence: (rawOutput?.confidence as number) ?? null,
                          malignancyProbability: (rawOutput?.malignancy_probability as number) ?? null,
                          lesionProbability: (rawOutput?.lesion_probability as number) ?? null,
                          biradsPrediction: (rawOutput?.birads_prediction as number) ?? null,
                          biradsProbabilities: (rawOutput?.birads_probabilities as Record<string, number>) ?? null,
                      }
                    : null,
            }
        })

        // Compute summary statistics
        const totalReports = reports.length
        const biradsDistribution: Record<number, number> = {}
        const riskTierDistribution: Record<string, number> = {
            LOW: 0,
            MODERATE: 0,
            ELEVATED: 0,
            HIGH: 0,
        }
        let confidenceSum = 0
        let confidenceCount = 0

        for (const report of reports) {
            // BI-RADS distribution
            const b = report.biradsClassification
            biradsDistribution[b] = (biradsDistribution[b] || 0) + 1

            // Risk tier distribution
            if (report.aiInference?.riskTier) {
                riskTierDistribution[report.aiInference.riskTier] =
                    (riskTierDistribution[report.aiInference.riskTier] || 0) + 1
            }

            // Average confidence
            if (report.aiInference?.confidence != null) {
                confidenceSum += report.aiInference.confidence
                confidenceCount++
            }
        }

        const averageConfidence =
            confidenceCount > 0 ? Math.round((confidenceSum / confidenceCount) * 100) / 100 : null

        return NextResponse.json({
            success: true,
            reports,
            summary: {
                totalReports,
                biradsDistribution,
                riskTierDistribution,
                averageConfidence,
                periodDays: days,
            },
        })
    } catch (error) {
        console.error("Reports API error:", error)
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        )
    }
}
