import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import {
    Upload, FileText, Clock, CheckCircle,
    HeartPulse, Bell, HelpCircle, LogOut,
    ArrowRight, Activity, TrendingUp, Sparkles
} from "lucide-react"
import { formatDate } from "@/lib/utils"

export default async function PatientDashboard() {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "PATIENT") {
        redirect("/auth/login")
    }

    // Fetch patient data and cases
    const patient = await prisma.patient.findUnique({
        where: { userId: session.user.id },
        include: {
            cases: {
                orderBy: { createdAt: "desc" },
                take: 5,
                include: {
                    communications: {
                        where: { sentToPatient: true },
                        orderBy: { sentAt: "desc" },
                        take: 1,
                    },
                },
            },
        },
    })

    const pendingCases = patient?.cases.filter(c => c.status !== "CLOSED").length || 0
    const completedCases = patient?.cases.filter(c => c.status === "CLOSED").length || 0
    const totalCases = patient?.cases.length || 0

    // Time-based greeting
    const hour = new Date().getHours()
    const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening"

    return (
        <div className="min-h-screen animated-gradient-bg">
            {/* Header */}
            <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-sm shadow-black/[0.02]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3 group">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                                <HeartPulse className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-semibold text-slate-800">
                                BreastScreen<span className="text-blue-600">AI</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="p-2.5 rounded-xl hover:bg-white/60 text-slate-500 hover:text-slate-700 transition-all duration-200 hover:shadow-sm relative">
                                <Bell className="w-5 h-5" />
                                {pendingCases > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold animate-pulse">
                                        {pendingCases}
                                    </span>
                                )}
                            </button>
                            <div className="w-px h-6 bg-slate-200" />
                            <Link
                                href="/api/auth/signout"
                                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-xl hover:bg-white/60 transition-all duration-200"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="hidden sm:inline">Sign Out</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Welcome Section */}
                <div className="mb-8 animate-fade-in-up">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-blue-600 font-medium">{greeting}</span>
                        <Sparkles className="w-4 h-4 text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        Welcome, {session.user.name?.split(" ")[0] || "there"} 👋
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Your screening results are always reviewed by certified specialists.
                    </p>
                </div>

                {/* Disclaimer Banner */}
                <div className="disclaimer-banner mb-8 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
                    <p className="flex items-start gap-2">
                        <HelpCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                            <strong>Reminder:</strong> This is a screening support tool.
                            All findings are reviewed by qualified doctors before reaching you.
                            For urgent concerns, please contact your healthcare provider directly.
                        </span>
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <Link
                        href="/upload"
                        className="card-interactive p-6 flex items-center gap-5 group animate-fade-in-up"
                        style={{ animationDelay: "200ms" }}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-blue-500/40">
                            <Upload className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">Upload Mammogram</h3>
                            <p className="text-sm text-slate-500">
                                Submit a new screening image for expert review
                            </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-all duration-300 group-hover:translate-x-1" />
                    </Link>

                    <Link
                        href="/dashboard/patient/cases"
                        className="card-interactive p-6 flex items-center gap-5 group animate-fade-in-up"
                        style={{ animationDelay: "300ms" }}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-emerald-500/40">
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">View My Cases</h3>
                            <p className="text-sm text-slate-500">
                                Check the status of your submitted screenings
                            </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-all duration-300 group-hover:translate-x-1" />
                    </Link>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                    <div
                        className="card-glass p-6 stat-card stat-card-amber animate-fade-in-up group hover:shadow-lg transition-all duration-300"
                        style={{ animationDelay: "400ms" }}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                                <Clock className="w-5 h-5 text-amber-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-500">Pending Review</span>
                        </div>
                        <p className="text-4xl font-bold text-slate-900">{pendingCases}</p>
                        {pendingCases > 0 && (
                            <div className="mt-3">
                                <div className="progress-bar">
                                    <div className="progress-bar-fill" style={{ width: "60%", background: "linear-gradient(90deg, #f59e0b, #d97706)" }} />
                                </div>
                                <p className="text-xs text-amber-600 mt-1.5 font-medium">In progress</p>
                            </div>
                        )}
                    </div>

                    <div
                        className="card-glass p-6 stat-card stat-card-green animate-fade-in-up group hover:shadow-lg transition-all duration-300"
                        style={{ animationDelay: "500ms" }}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-500">Completed</span>
                        </div>
                        <p className="text-4xl font-bold text-slate-900">{completedCases}</p>
                        {completedCases > 0 && (
                            <div className="flex items-center gap-1.5 mt-3">
                                <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                                <p className="text-xs text-green-600 font-medium">All reviewed</p>
                            </div>
                        )}
                    </div>

                    <div
                        className="card-glass p-6 stat-card stat-card-blue animate-fade-in-up group hover:shadow-lg transition-all duration-300"
                        style={{ animationDelay: "600ms" }}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                                <Activity className="w-5 h-5 text-blue-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-500">Total Submissions</span>
                        </div>
                        <p className="text-4xl font-bold text-slate-900">{totalCases}</p>
                    </div>
                </div>

                {/* Recent Cases */}
                <div className="card-glass p-6 animate-fade-in-up" style={{ animationDelay: "700ms" }}>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-500" />
                            Recent Submissions
                        </h2>
                        {totalCases > 0 && (
                            <Link
                                href="/dashboard/patient/cases"
                                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-all hover:gap-2"
                            >
                                View all
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        )}
                    </div>

                    {patient?.cases.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
                                <FileText className="w-10 h-10 text-slate-300" />
                            </div>
                            <p className="text-slate-600 font-medium mb-1">No submissions yet</p>
                            <p className="text-sm text-slate-400 mb-6">Start by uploading your first mammogram image</p>
                            <Link
                                href="/upload"
                                className="btn btn-primary btn-shimmer inline-flex shadow-lg shadow-blue-500/20"
                            >
                                <Upload className="w-4 h-4" />
                                Upload Your First Mammogram
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {patient?.cases.map((caseItem, index) => (
                                <div
                                    key={caseItem.id}
                                    className="list-item-interactive flex items-center justify-between p-4 bg-white/50"
                                    style={{ animationDelay: `${800 + index * 100}ms` }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${caseItem.status === "CLOSED"
                                                ? "bg-green-100"
                                                : caseItem.status === "UNDER_REVIEW"
                                                    ? "bg-amber-100"
                                                    : "bg-blue-100"
                                            }`}>
                                            {caseItem.status === "CLOSED" ? (
                                                <CheckCircle className="w-5 h-5 text-green-600" />
                                            ) : caseItem.status === "UNDER_REVIEW" ? (
                                                <Clock className="w-5 h-5 text-amber-600" />
                                            ) : (
                                                <FileText className="w-5 h-5 text-blue-600" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">
                                                Case #{caseItem.id.slice(-8).toUpperCase()}
                                            </p>
                                            <p className="text-sm text-slate-500">
                                                Submitted {formatDate(caseItem.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`badge badge-dot ${caseItem.status === "REVIEWED" || caseItem.status === "CLOSED"
                                            ? "badge-success"
                                            : caseItem.status === "UNDER_REVIEW"
                                                ? "badge-warning"
                                                : "badge-info"
                                            }`}>
                                            {caseItem.status.replace("_", " ")}
                                        </span>
                                        <Link
                                            href={`/dashboard/patient/cases/${caseItem.id}`}
                                            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-all hover:gap-2"
                                        >
                                            View
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
