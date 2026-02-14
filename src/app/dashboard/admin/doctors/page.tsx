import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import {
    ArrowLeft, HeartPulse, UserCheck, Users,
    CheckCircle, Clock, XCircle, Search, Filter
} from "lucide-react"
import { formatDate } from "@/lib/utils"

interface PageProps {
    searchParams: Promise<{ status?: string }>
}

export default async function DoctorsListPage({ searchParams }: PageProps) {
    const session = await getServerSession(authOptions)
    const { status } = await searchParams

    if (!session || session.user.role !== "ADMIN") {
        redirect("/auth/login")
    }

    // Build filter
    const statusFilter = status === "pending"
        ? { verificationStatus: "PENDING" as const }
        : status === "verified"
            ? { verificationStatus: "VERIFIED" as const }
            : status === "revoked"
                ? { verificationStatus: "REVOKED" as const }
                : {}

    // Fetch doctors
    const doctors = await prisma.doctor.findMany({
        where: statusFilter,
        include: {
            user: true,
            _count: {
                select: { reviews: true }
            }
        },
        orderBy: [
            { verificationStatus: "asc" },
            { user: { createdAt: "desc" } }
        ]
    })

    // Stats
    const stats = await prisma.doctor.groupBy({
        by: ["verificationStatus"],
        _count: true
    })

    const pendingCount = stats.find(s => s.verificationStatus === "PENDING")?._count || 0
    const verifiedCount = stats.find(s => s.verificationStatus === "VERIFIED")?._count || 0
    const revokedCount = stats.find(s => s.verificationStatus === "REVOKED")?._count || 0

    const getStatusBadge = (verStatus: string) => {
        switch (verStatus) {
            case "PENDING":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="w-3 h-3" />
                        Pending
                    </span>
                )
            case "VERIFIED":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                    </span>
                )
            case "REVOKED":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3" />
                        Revoked
                    </span>
                )
            default:
                return null
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard/admin"
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center">
                                    <HeartPulse className="w-5 h-5 text-white" />
                                </div>
                                <span className="font-semibold text-slate-800">Manage Doctors</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <Link
                        href="/dashboard/admin/doctors?status=pending"
                        className={`card p-4 ${status === "pending" ? "ring-2 ring-violet-500" : ""}`}
                    >
                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-yellow-500" />
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{pendingCount}</p>
                                <p className="text-sm text-slate-600">Pending</p>
                            </div>
                        </div>
                    </Link>
                    <Link
                        href="/dashboard/admin/doctors?status=verified"
                        className={`card p-4 ${status === "verified" ? "ring-2 ring-violet-500" : ""}`}
                    >
                        <div className="flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{verifiedCount}</p>
                                <p className="text-sm text-slate-600">Verified</p>
                            </div>
                        </div>
                    </Link>
                    <Link
                        href="/dashboard/admin/doctors?status=revoked"
                        className={`card p-4 ${status === "revoked" ? "ring-2 ring-violet-500" : ""}`}
                    >
                        <div className="flex items-center gap-3">
                            <XCircle className="w-5 h-5 text-red-500" />
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{revokedCount}</p>
                                <p className="text-sm text-slate-600">Revoked</p>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 mb-6">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <Link
                        href="/dashboard/admin/doctors"
                        className={`px-3 py-1.5 rounded-full text-sm font-medium ${!status ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                        All
                    </Link>
                    <Link
                        href="/dashboard/admin/doctors?status=pending"
                        className={`px-3 py-1.5 rounded-full text-sm font-medium ${status === "pending" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                        Pending
                    </Link>
                    <Link
                        href="/dashboard/admin/doctors?status=verified"
                        className={`px-3 py-1.5 rounded-full text-sm font-medium ${status === "verified" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                        Verified
                    </Link>
                </div>

                {/* Doctors Table */}
                <div className="card overflow-hidden">
                    {doctors.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-600">No doctors found</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Doctor</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Specialty</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">License</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Status</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Reviews</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {doctors.map((doctor) => (
                                    <tr key={doctor.id} className="border-t border-slate-100 hover:bg-slate-50">
                                        <td className="py-4 px-4">
                                            <div>
                                                <p className="font-medium text-slate-900">{doctor.user.name}</p>
                                                <p className="text-sm text-slate-500">{doctor.user.email}</p>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="text-sm text-slate-600">{doctor.specialty}</span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="font-mono text-sm text-slate-600">{doctor.licenseNumber}</span>
                                            <p className="text-xs text-slate-400">Exp: {formatDate(doctor.licenseExpiry)}</p>
                                        </td>
                                        <td className="py-4 px-4">
                                            {getStatusBadge(doctor.verificationStatus)}
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="text-sm text-slate-600">{doctor._count.reviews}</span>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <Link
                                                href={`/dashboard/admin/doctors/${doctor.id}/verify`}
                                                className="btn btn-secondary py-1.5 px-3 text-sm"
                                            >
                                                {doctor.verificationStatus === "PENDING" ? "Review" : "Manage"}
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>
        </div>
    )
}
