import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import {
    ArrowLeft, HeartPulse, Calendar, Clock, CheckCircle,
    FileImage, AlertCircle, HelpCircle, Phone
} from "lucide-react"
import { formatDate, formatDateTime } from "@/lib/utils"

interface PageProps {
    params: Promise<{ caseId: string }>
}

export default async function PatientCaseDetailPage({ params }: PageProps) {
    const session = await getServerSession(authOptions)
    const { caseId } = await params

    if (!session || session.user.role !== "PATIENT") {
        redirect("/auth/login")
    }

    const patient = await prisma.patient.findUnique({
        where: { userId: session.user.id }
    })

    if (!patient) {
        redirect("/auth/login")
    }

    // Fetch case data
    const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
            images: true,
            communications: {
                where: { sentToPatient: true },
                orderBy: { sentAt: "desc" },
                take: 1,
            },
            doctorReviews: {
                orderBy: { reviewCompletedAt: "desc" },
                take: 1,
                include: {
                    doctor: {
                        include: { user: true }
                    }
                }
            }
        }
    })

    if (!caseData) {
        notFound()
    }

    // Verify this case belongs to the patient
    if (caseData.patientId !== patient.id) {
        redirect("/dashboard/patient")
    }

    const communication = caseData.communications[0]
    const review = caseData.doctorReviews[0]
    const isReviewed = caseData.status === "REVIEWED" || caseData.status === "CLOSED"

    // Status badge styling
    const getStatusStyle = (status: string) => {
        switch (status) {
            case "PENDING_REVIEW":
                return "bg-blue-100 text-blue-800"
            case "UNDER_REVIEW":
                return "bg-yellow-100 text-yellow-800"
            case "REVIEWED":
                return "bg-green-100 text-green-800"
            case "CLOSED":
                return "bg-gray-100 text-gray-800"
            default:
                return "bg-gray-100 text-gray-800"
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "PENDING_REVIEW":
            case "UNDER_REVIEW":
                return <Clock className="w-4 h-4" />
            case "REVIEWED":
            case "CLOSED":
                return <CheckCircle className="w-4 h-4" />
            default:
                return <Clock className="w-4 h-4" />
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard/patient"
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                                    <HeartPulse className="w-5 h-5 text-white" />
                                </div>
                                <span className="font-semibold text-slate-800">Case Details</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Case Header */}
                <div className="card p-6 mb-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-slate-500 mb-1">Case Reference</p>
                            <h1 className="text-2xl font-bold text-slate-900 font-mono">
                                #{caseId.slice(-8).toUpperCase()}
                            </h1>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${getStatusStyle(caseData.status)}`}>
                            {getStatusIcon(caseData.status)}
                            {caseData.status.replace("_", " ")}
                        </span>
                    </div>

                    <div className="mt-6 grid md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">Submitted</p>
                                <p className="text-sm font-medium text-slate-900">
                                    {formatDate(caseData.createdAt)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <FileImage className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">Images</p>
                                <p className="text-sm font-medium text-slate-900">
                                    {caseData.images.length} uploaded
                                </p>
                            </div>
                        </div>
                        {review && (
                            <div className="flex items-center gap-3">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                                <div>
                                    <p className="text-xs text-slate-500">Reviewed</p>
                                    <p className="text-sm font-medium text-slate-900">
                                        {formatDate(review.reviewCompletedAt)}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Results Section - Only show if reviewed */}
                {isReviewed && communication ? (
                    <div className="card p-6 mb-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            Your Results
                        </h2>

                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <h3 className="font-medium text-slate-900 mb-2">Summary</h3>
                                <p className="text-slate-700">{communication.summaryText}</p>
                            </div>

                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h3 className="font-medium text-blue-900 mb-2">Recommended Next Steps</h3>
                                <p className="text-blue-800">{communication.recommendationText}</p>
                            </div>
                        </div>

                        {review && (
                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <p className="text-sm text-slate-500">
                                    Reviewed by Dr. {review.doctor.user.name} • {formatDateTime(review.reviewCompletedAt)}
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="card p-6 mb-6">
                        <div className="text-center py-8">
                            <Clock className="w-12 h-12 text-blue-300 mx-auto mb-4" />
                            <h2 className="text-lg font-semibold text-slate-900 mb-2">
                                Review in Progress
                            </h2>
                            <p className="text-slate-600 max-w-md mx-auto">
                                Your mammogram images are being reviewed by a qualified specialist.
                                Results are typically available within 24-72 hours.
                            </p>
                        </div>
                    </div>
                )}

                {/* Images Submitted */}
                <div className="card p-6 mb-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <FileImage className="w-5 h-5 text-slate-600" />
                        Images Submitted
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {caseData.images.map((image, index) => (
                            <div
                                key={image.id}
                                className="aspect-square bg-slate-100 rounded-lg flex flex-col items-center justify-center p-4"
                            >
                                <FileImage className="w-8 h-8 text-slate-400 mb-2" />
                                <p className="text-xs text-slate-600 text-center">
                                    {image.laterality || "Breast"} {image.viewPosition || `View ${index + 1}`}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Help Section */}
                <div className="card p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                            <HelpCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-green-900 mb-1">Need Help?</h3>
                            <p className="text-sm text-green-800 mb-3">
                                If you have questions about your results or need to speak with someone,
                                please contact your healthcare provider directly.
                            </p>
                            <div className="flex items-center gap-2 text-sm text-green-700">
                                <Phone className="w-4 h-4" />
                                <span>Contact your doctor&apos;s office for medical questions</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Disclaimer */}
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">
                            <strong>Important:</strong> This is a screening support tool. All findings have been
                            reviewed by certified medical professionals. For urgent medical concerns, please
                            contact your healthcare provider directly or visit your nearest emergency room.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
