import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import {
    ClipboardList, Clock, CheckCircle, AlertTriangle,
    HeartPulse, Bell, LogOut, FileSearch, BarChart3,
    ArrowRight, Sparkles, Activity, Eye
} from "lucide-react"
import { formatDateTime } from "@/lib/utils"

export default async function DoctorDashboard() {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "DOCTOR") {
        redirect("/auth/login")
    }

    // Fetch doctor data
    const doctor = await prisma.doctor.findUnique({
        where: { userId: session.user.id },
    })

    if (!doctor) {
        redirect("/auth/login")
    }

    // Check verification status
    if (doctor.verificationStatus !== "VERIFIED") {
        return (
            <div className="min-h-screen flex items-center justify-center animated-gradient-bg px-4">
                <div className="card-glass p-10 max-w-md text-center animate-scale-in shadow-xl">
                    <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-5">
                        <AlertTriangle className="w-8 h-8 text-amber-500" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">
                        Account Pending Verification
                    </h1>
                    <p className="text-slate-600 mb-6 leading-relaxed">
                        Your medical credentials are being reviewed by our admin team.
                        This typically takes 1-2 business days.
                    </p>
                    <div className="mb-6">
                        <div className="progress-bar">
                            <div className="progress-bar-fill" style={{ width: "45%", background: "linear-gradient(90deg, #f59e0b, #d97706)" }} />
                        </div>
                        <p className="text-xs text-amber-600 mt-2 font-medium">Verification in progress</p>
                    </div>
                    <p className="text-sm text-slate-400 mb-6">
                        License: <span className="font-mono text-slate-600">{doctor.licenseNumber}</span>
                    </p>
                    <Link
                        href="/api/auth/signout"
                        className="btn btn-secondary inline-flex"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </Link>
                </div>
            </div>
        )
    }

    // Fetch assigned cases
    const pendingCases = await prisma.case.count({
        where: {
            assignedDoctorId: doctor.id,
            status: "PENDING_REVIEW",
        },
    })

    const underReviewCases = await prisma.case.count({
        where: {
            assignedDoctorId: doctor.id,
            status: "UNDER_REVIEW",
        },
    })

    const completedToday = await prisma.doctorReview.count({
        where: {
            doctorId: doctor.id,
            reviewCompletedAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
        },
    })

    // Fetch recent cases for review
    const casesForReview = await prisma.case.findMany({
        where: {
            assignedDoctorId: doctor.id,
            status: { in: ["PENDING_REVIEW", "UNDER_REVIEW"] },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
        include: {
            images: true,
            aiInferences: {
                orderBy: { inferenceTimestamp: "desc" },
                take: 1,
            },
        },
    })

    const hour = new Date().getHours()
    const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening"

    return (
        <div className="min-h-screen animated-gradient-bg">
            {/* Header */}
            <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-sm shadow-black/[0.02]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3 group">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-800 flex items-center justify-center shadow-lg shadow-indigo-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                                <HeartPulse className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <span className="font-semibold text-slate-800">
                                    BreastScreen<span className="text-blue-600">AI</span>
                                </span>
                                <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-medium">
                                    Doctor Portal
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="p-2.5 rounded-xl hover:bg-white/60 text-slate-500 hover:text-slate-700 transition-all duration-200 relative">
                                <Bell className="w-5 h-5" />
                                {pendingCases > 0 && (
                                    <>
                                        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                                            {pendingCases}
                                        </span>
                                        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full animate-ping opacity-75" />
                                    </>
                                )}
                            </button>
                            <div className="w-px h-6 bg-slate-200" />
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-slate-900">{session.user.name}</p>
                                <p className="text-xs text-slate-400">{doctor.specialty}</p>
                            </div>
                            <Link
                                href="/api/auth/signout"
                                className="p-2.5 rounded-xl hover:bg-white/60 text-slate-500 hover:text-slate-700 transition-all duration-200"
                            >
                                <LogOut className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Welcome */}
                <div className="mb-8 animate-fade-in-up">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-indigo-600 font-medium">{greeting}, Dr. {session.user.name?.split(" ").pop()}</span>
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        Review Dashboard
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Your clinical judgment is the final authority on all cases.
                    </p>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
                    <div className="card-glass p-5 stat-card stat-card-amber animate-fade-in-up group hover:shadow-lg transition-all duration-300 border-l-4 border-amber-400" style={{ animationDelay: "100ms" }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                                <Clock className="w-5 h-5 text-amber-600" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-slate-900">{pendingCases}</p>
                        <p className="text-sm text-slate-500 font-medium mt-1">Pending Review</p>
                        {pendingCases > 0 && (
                            <div className="mt-2">
                                <span className="badge badge-warning badge-dot text-xs">Action needed</span>
                            </div>
                        )}
                    </div>

                    <div className="card-glass p-5 stat-card stat-card-blue animate-fade-in-up group hover:shadow-lg transition-all duration-300 border-l-4 border-blue-400" style={{ animationDelay: "200ms" }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                                <FileSearch className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-slate-900">{underReviewCases}</p>
                        <p className="text-sm text-slate-500 font-medium mt-1">Under Review</p>
                        {underReviewCases > 0 && (
                            <div className="mt-2">
                                <span className="badge badge-info badge-dot text-xs">In progress</span>
                            </div>
                        )}
                    </div>

                    <div className="card-glass p-5 stat-card stat-card-green animate-fade-in-up group hover:shadow-lg transition-all duration-300 border-l-4 border-green-400" style={{ animationDelay: "300ms" }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-slate-900">{completedToday}</p>
                        <p className="text-sm text-slate-500 font-medium mt-1">Completed Today</p>
                        {completedToday > 0 && (
                            <div className="mt-2">
                                <span className="badge badge-success text-xs">Great work!</span>
                            </div>
                        )}
                    </div>

                    <div className="card-glass p-5 stat-card stat-card-indigo animate-fade-in-up group hover:shadow-lg transition-all duration-300 border-l-4 border-indigo-400" style={{ animationDelay: "400ms" }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                                <BarChart3 className="w-5 h-5 text-indigo-600" />
                            </div>
                        </div>
                        <p className="text-lg font-bold text-slate-900 leading-tight">
                            {doctor.assignedRegions.join(", ")}
                        </p>
                        <p className="text-sm text-slate-500 font-medium mt-1">Assigned Regions</p>
                    </div>
                </div>

                {/* Review Queue */}
                <div className="card-glass p-6 animate-fade-in-up" style={{ animationDelay: "500ms" }}>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-indigo-500" />
                            Cases Awaiting Review
                            {casesForReview.length > 0 && (
                                <span className="ml-2 bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">
                                    {casesForReview.length}
                                </span>
                            )}
                        </h2>
                        <Link
                            href="/dashboard/doctor/cases"
                            className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-all hover:gap-2"
                        >
                            View All
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    {casesForReview.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-20 h-20 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-5">
                                <CheckCircle className="w-10 h-10 text-green-400" />
                            </div>
                            <p className="text-slate-700 font-semibold text-lg mb-1">All caught up! 🎉</p>
                            <p className="text-sm text-slate-400">No cases pending review at this time.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200/60">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50/80">
                                        <th className="text-left py-3.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Case ID</th>
                                        <th className="text-left py-3.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Region</th>
                                        <th className="text-left py-3.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted</th>
                                        <th className="text-left py-3.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Images</th>
                                        <th className="text-left py-3.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Risk Tier</th>
                                        <th className="text-left py-3.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="text-right py-3.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {casesForReview.map((caseItem, index) => {
                                        const aiInference = caseItem.aiInferences[0]
                                        return (
                                            <tr
                                                key={caseItem.id}
                                                className="table-row-interactive hover:bg-blue-50/50 transition-all duration-200"
                                                style={{ animationDelay: `${600 + index * 80}ms` }}
                                            >
                                                <td className="py-4 px-4">
                                                    <span className="font-mono text-sm font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                                        {caseItem.id.slice(-8).toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className="text-sm text-slate-600">{caseItem.regionCode}</span>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className="text-sm text-slate-500">
                                                        {formatDateTime(caseItem.createdAt)}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className="text-sm font-medium text-slate-900">{caseItem.images.length}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    {aiInference ? (
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${aiInference.riskTier === "LOW" ? "risk-low" :
                                                            aiInference.riskTier === "MODERATE" ? "risk-moderate" :
                                                                aiInference.riskTier === "ELEVATED" ? "risk-elevated" :
                                                                    "risk-high"
                                                            }`}>
                                                            {aiInference.riskTier}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Pending</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className={`badge badge-dot ${caseItem.status === "PENDING_REVIEW" ? "badge-warning" : "badge-info"
                                                        }`}>
                                                        {caseItem.status.replace("_", " ")}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <Link
                                                        href={`/review/${caseItem.id}`}
                                                        className="btn btn-primary btn-shimmer py-2 px-5 text-sm shadow-md shadow-blue-500/15 hover:shadow-blue-500/25"
                                                    >
                                                        <Activity className="w-3.5 h-3.5" />
                                                        Review
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Important Notice */}
                <div className="mt-8 card-glass p-5 border-l-4 border-blue-400 animate-fade-in-up" style={{ animationDelay: "700ms" }}>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Activity className="w-4 h-4 text-blue-600" />
                        </div>
                        <p className="text-sm text-blue-800">
                            <strong>Reminder:</strong> AI assistance is shown only after your initial assessment.
                            Your clinical judgment is the final authority on all cases.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
