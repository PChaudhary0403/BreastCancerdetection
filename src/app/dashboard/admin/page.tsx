import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import {
    Users, UserCheck, Shield, Activity,
    HeartPulse, LogOut, Settings, Database,
    AlertTriangle, CheckCircle, Clock,
    ArrowRight, Bell, Sparkles, BarChart3, Eye
} from "lucide-react"

export default async function AdminDashboard() {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
        redirect("/auth/login")
    }

    // Fetch admin data
    const admin = await prisma.admin.findUnique({
        where: { userId: session.user.id },
    })

    if (!admin) {
        redirect("/auth/login")
    }

    // Fetch system stats
    const [
        totalPatients,
        totalDoctors,
        pendingDoctors,
        totalCases,
        activeModel,
        recentAlerts,
    ] = await Promise.all([
        prisma.patient.count(),
        prisma.doctor.count({ where: { verificationStatus: "VERIFIED" } }),
        prisma.doctor.count({ where: { verificationStatus: "PENDING" } }),
        prisma.case.count(),
        prisma.modelVersion.findFirst({ where: { status: "ACTIVE" } }),
        prisma.driftMonitoring.count({ where: { alertTriggered: true, reviewedById: null } }),
    ])

    // Pending doctor verifications
    const pendingVerifications = await prisma.doctor.findMany({
        where: { verificationStatus: "PENDING" },
        include: { user: true },
        orderBy: { user: { createdAt: "asc" } },
        take: 5,
    })

    return (
        <div className="min-h-screen animated-gradient-bg">
            {/* Header */}
            <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-sm shadow-black/[0.02]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3 group">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                                <HeartPulse className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <span className="font-semibold text-slate-800">
                                    BreastScreen<span className="text-violet-600">AI</span>
                                </span>
                                <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-2.5 py-0.5 rounded-full font-medium">
                                    Admin Console
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link
                                href="/dashboard/admin/settings"
                                className="p-2.5 rounded-xl hover:bg-white/60 text-slate-500 hover:text-slate-700 transition-all duration-200 hover:shadow-sm"
                            >
                                <Settings className="w-5 h-5" />
                            </Link>
                            <button className="p-2.5 rounded-xl hover:bg-white/60 text-slate-500 hover:text-slate-700 transition-all duration-200 relative">
                                <Bell className="w-5 h-5" />
                                {(pendingDoctors > 0 || recentAlerts > 0) && (
                                    <>
                                        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                                            {pendingDoctors + recentAlerts}
                                        </span>
                                        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full animate-ping opacity-75" />
                                    </>
                                )}
                            </button>
                            <div className="w-px h-6 bg-slate-200" />
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-slate-900">{session.user.name}</p>
                                <p className="text-xs text-slate-400">Administrator</p>
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
                        <span className="text-sm text-violet-600 font-medium">System Overview</span>
                        <Sparkles className="w-4 h-4 text-violet-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        Admin Dashboard
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Monitor system health, manage users, and oversee platform operations.
                    </p>
                </div>

                {/* Alert Banner */}
                {(pendingDoctors > 0 || recentAlerts > 0) && (
                    <div className="mb-8 card-glass p-5 border-l-4 border-amber-400 animate-fade-in-up" style={{ animationDelay: "50ms" }}>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="flex-1 space-y-1">
                                {pendingDoctors > 0 && (
                                    <p className="text-sm text-amber-800 font-medium">
                                        <strong>{pendingDoctors}</strong> doctor(s) awaiting credential verification
                                    </p>
                                )}
                                {recentAlerts > 0 && (
                                    <p className="text-sm text-amber-800 font-medium">
                                        <strong>{recentAlerts}</strong> model drift alert(s) need review
                                    </p>
                                )}
                            </div>
                            <Link
                                href="/dashboard/admin/doctors?status=pending"
                                className="btn btn-secondary py-2 px-4 text-sm flex-shrink-0"
                            >
                                Review Now
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid md:grid-cols-4 gap-5 mb-8">
                    <div className="card-glass p-6 stat-card stat-card-blue animate-fade-in-up group hover:shadow-lg transition-all duration-300 border-l-4 border-blue-400" style={{ animationDelay: "100ms" }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-slate-900">{totalPatients}</p>
                        <p className="text-sm text-slate-500 font-medium mt-1">Total Patients</p>
                    </div>

                    <div className="card-glass p-6 stat-card stat-card-green animate-fade-in-up group hover:shadow-lg transition-all duration-300 border-l-4 border-green-400" style={{ animationDelay: "200ms" }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                                <UserCheck className="w-5 h-5 text-green-600" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-slate-900">{totalDoctors}</p>
                        <p className="text-sm text-slate-500 font-medium mt-1">Verified Doctors</p>
                        {pendingDoctors > 0 && (
                            <div className="mt-2">
                                <span className="badge badge-warning badge-dot text-xs">{pendingDoctors} pending</span>
                            </div>
                        )}
                    </div>

                    <div className="card-glass p-6 stat-card stat-card-indigo animate-fade-in-up group hover:shadow-lg transition-all duration-300 border-l-4 border-indigo-400" style={{ animationDelay: "300ms" }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                                <Database className="w-5 h-5 text-indigo-600" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-slate-900">{totalCases}</p>
                        <p className="text-sm text-slate-500 font-medium mt-1">Total Cases</p>
                    </div>

                    <div className="card-glass p-6 stat-card animate-fade-in-up group hover:shadow-lg transition-all duration-300 border-l-4 border-violet-400" style={{ animationDelay: "400ms" }}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                                <Activity className="w-5 h-5 text-violet-600" />
                            </div>
                        </div>
                        <p className="text-lg font-bold text-slate-900">
                            {activeModel?.version || "None"}
                        </p>
                        <p className="text-sm text-slate-500 font-medium mt-1">Active Model</p>
                        {activeModel && (
                            <div className="mt-2">
                                <span className="badge badge-success text-xs">Active</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <Link
                        href="/dashboard/admin/doctors"
                        className="card-interactive p-6 flex items-center gap-5 group animate-fade-in-up"
                        style={{ animationDelay: "500ms" }}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/25 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-green-500/40">
                            <UserCheck className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 group-hover:text-green-700 transition-colors">Manage Doctors</h3>
                            <p className="text-sm text-slate-500">Verify credentials & manage access</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-green-500 transition-all duration-300 group-hover:translate-x-1" />
                    </Link>

                    <Link
                        href="/dashboard/admin/models"
                        className="card-interactive p-6 flex items-center gap-5 group animate-fade-in-up"
                        style={{ animationDelay: "600ms" }}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-violet-500/40">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 group-hover:text-violet-700 transition-colors">Model Management</h3>
                            <p className="text-sm text-slate-500">Deploy, monitor & rollback models</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-violet-500 transition-all duration-300 group-hover:translate-x-1" />
                    </Link>

                    <Link
                        href="/dashboard/admin/audit"
                        className="card-interactive p-6 flex items-center gap-5 group animate-fade-in-up"
                        style={{ animationDelay: "700ms" }}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-lg shadow-slate-500/25 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-slate-500/40">
                            <Database className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">Audit Logs</h3>
                            <p className="text-sm text-slate-500">View system activity & access logs</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-all duration-300 group-hover:translate-x-1" />
                    </Link>
                </div>

                {/* Pending Verifications */}
                <div className="card-glass p-6 animate-fade-in-up" style={{ animationDelay: "800ms" }}>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                            <Clock className="w-5 h-5 text-violet-500" />
                            Pending Doctor Verifications
                            {pendingVerifications.length > 0 && (
                                <span className="ml-2 bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
                                    {pendingVerifications.length}
                                </span>
                            )}
                        </h2>
                        <Link
                            href="/dashboard/admin/doctors?status=pending"
                            className="text-sm font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1 transition-all hover:gap-2"
                        >
                            View All
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    {pendingVerifications.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-20 h-20 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-5">
                                <CheckCircle className="w-10 h-10 text-green-400" />
                            </div>
                            <p className="text-slate-700 font-semibold text-lg mb-1">All clear! ✅</p>
                            <p className="text-sm text-slate-400">No pending verifications at this time.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pendingVerifications.map((doctor, index) => (
                                <div
                                    key={doctor.id}
                                    className="list-item-interactive flex items-center justify-between p-4 bg-white/50"
                                    style={{ animationDelay: `${900 + index * 100}ms` }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                                            <span className="text-sm font-bold text-violet-600">
                                                {doctor.user.name?.charAt(0)?.toUpperCase() || "D"}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">{doctor.user.name}</p>
                                            <p className="text-sm text-slate-500">
                                                {doctor.specialty} • License: <span className="font-mono">{doctor.licenseNumber}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="badge badge-warning badge-dot text-xs">Pending</span>
                                        <Link
                                            href={`/dashboard/admin/doctors/${doctor.id}/verify`}
                                            className="btn btn-primary btn-shimmer py-2 px-5 text-sm shadow-md shadow-violet-500/15 hover:shadow-violet-500/25"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            Review
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* System Notice */}
                <div className="mt-8 card-glass p-5 border-l-4 border-violet-400 animate-fade-in-up" style={{ animationDelay: "1000ms" }}>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-4 h-4 text-violet-600" />
                        </div>
                        <p className="text-sm text-violet-800">
                            <strong>Admin Responsibility:</strong> You oversee system integrity, user access, and model deployment.
                            You do not make medical decisions. All clinical judgments are made by verified doctors only.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
