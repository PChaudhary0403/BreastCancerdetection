import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import {
    ArrowLeft, HeartPulse, UserCheck, Shield, Calendar,
    MapPin, Stethoscope, CheckCircle, XCircle, AlertTriangle
} from "lucide-react"
import { formatDate } from "@/lib/utils"
import VerificationActions from "./verification-actions"

interface PageProps {
    params: Promise<{ doctorId: string }>
}

export default async function DoctorVerificationPage({ params }: PageProps) {
    const session = await getServerSession(authOptions)
    const { doctorId } = await params

    if (!session || session.user.role !== "ADMIN") {
        redirect("/auth/login")
    }

    const admin = await prisma.admin.findUnique({
        where: { userId: session.user.id }
    })

    if (!admin) {
        redirect("/auth/login")
    }

    // Fetch doctor data
    const doctor = await prisma.doctor.findUnique({
        where: { id: doctorId },
        include: {
            user: true,
            reviews: {
                take: 5,
                orderBy: { reviewCompletedAt: "desc" }
            }
        }
    })

    if (!doctor) {
        notFound()
    }

    const statusColors = {
        PENDING: "bg-yellow-100 text-yellow-800",
        VERIFIED: "bg-green-100 text-green-800",
        REVOKED: "bg-red-100 text-red-800",
    }

    const statusIcons = {
        PENDING: <AlertTriangle className="w-4 h-4" />,
        VERIFIED: <CheckCircle className="w-4 h-4" />,
        REVOKED: <XCircle className="w-4 h-4" />,
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard/admin/doctors"
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center">
                                    <HeartPulse className="w-5 h-5 text-white" />
                                </div>
                                <span className="font-semibold text-slate-800">Doctor Verification</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Doctor Profile Card */}
                <div className="card p-6 mb-6">
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                <UserCheck className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">{doctor.user.name}</h1>
                                <p className="text-slate-600">{doctor.user.email}</p>
                            </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[doctor.verificationStatus]}`}>
                            {statusIcons[doctor.verificationStatus]}
                            {doctor.verificationStatus}
                        </span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Shield className="w-5 h-5 text-slate-400" />
                                <div>
                                    <p className="text-xs text-slate-500">License Number</p>
                                    <p className="font-mono font-medium text-slate-900">{doctor.licenseNumber}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-slate-400" />
                                <div>
                                    <p className="text-xs text-slate-500">License Expiry</p>
                                    <p className={`font-medium ${new Date(doctor.licenseExpiry) < new Date() ? "text-red-600" : "text-slate-900"}`}>
                                        {formatDate(doctor.licenseExpiry)}
                                        {new Date(doctor.licenseExpiry) < new Date() && " (EXPIRED)"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Stethoscope className="w-5 h-5 text-slate-400" />
                                <div>
                                    <p className="text-xs text-slate-500">Specialty</p>
                                    <p className="font-medium text-slate-900">{doctor.specialty}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <MapPin className="w-5 h-5 text-slate-400" />
                                <div>
                                    <p className="text-xs text-slate-500">Assigned Regions</p>
                                    <p className="font-medium text-slate-900">
                                        {doctor.assignedRegions.join(", ") || "None assigned"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <p className="text-sm text-slate-500">
                            Account created: {formatDate(doctor.user.createdAt)}
                            {doctor.licenseVerifiedAt && (
                                <span className="ml-4">Verified: {formatDate(doctor.licenseVerifiedAt)}</span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Verification Checklist */}
                <div className="card p-6 mb-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Verification Checklist</h2>

                    <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <span className="text-slate-700">Email address provided</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <span className="text-slate-700">Medical license number provided</span>
                        </div>
                        <div className={`flex items-center gap-3 p-3 rounded-lg ${new Date(doctor.licenseExpiry) > new Date() ? "bg-green-50" : "bg-red-50"}`}>
                            {new Date(doctor.licenseExpiry) > new Date() ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                                <XCircle className="w-5 h-5 text-red-500" />
                            )}
                            <span className={new Date(doctor.licenseExpiry) > new Date() ? "text-green-700" : "text-red-700"}>
                                License expiry date valid
                            </span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50">
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                            <span className="text-yellow-700">Manual verification of license with medical board required</span>
                        </div>
                    </div>
                </div>

                {/* Review History */}
                {doctor.verificationStatus === "VERIFIED" && doctor.reviews.length > 0 && (
                    <div className="card p-6 mb-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Reviews</h2>
                        <p className="text-slate-600 mb-4">
                            This doctor has completed {doctor.reviews.length} case review(s).
                        </p>
                    </div>
                )}

                {/* Verification Actions */}
                <VerificationActions
                    doctorId={doctor.id}
                    currentStatus={doctor.verificationStatus}
                    doctorName={doctor.user.name || "Doctor"}
                />

                {/* Admin Notice */}
                <div className="mt-6 p-4 bg-violet-50 border border-violet-200 rounded-lg">
                    <p className="text-sm text-violet-800">
                        <strong>Admin Responsibility:</strong> Before approving, verify the medical license
                        number with the appropriate medical licensing board. Document your verification
                        in the system notes.
                    </p>
                </div>
            </main>
        </div>
    )
}
