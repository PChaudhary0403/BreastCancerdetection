"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

interface VerificationActionsProps {
    doctorId: string
    currentStatus: string
    doctorName: string
}

export default function VerificationActions({
    doctorId,
    currentStatus,
    doctorName
}: VerificationActionsProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [actionType, setActionType] = useState<string | null>(null)

    const handleAction = async (action: "verify" | "revoke") => {
        setIsLoading(true)
        setActionType(action)

        try {
            const response = await fetch(`/api/admin/doctors/${doctorId}/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            })

            if (response.ok) {
                router.refresh()
            } else {
                const data = await response.json()
                alert(data.error || "Action failed")
            }
        } catch (error) {
            alert("An error occurred")
        } finally {
            setIsLoading(false)
            setActionType(null)
        }
    }

    if (currentStatus === "VERIFIED") {
        return (
            <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Verified</h2>
                </div>
                <p className="text-slate-600 mb-4">
                    {doctorName} is verified and can review cases.
                </p>
                <button
                    onClick={() => handleAction("revoke")}
                    disabled={isLoading}
                    className="btn bg-red-100 text-red-700 hover:bg-red-200"
                >
                    {isLoading && actionType === "revoke" ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Revoking...
                        </>
                    ) : (
                        <>
                            <XCircle className="w-4 h-4" />
                            Revoke Verification
                        </>
                    )}
                </button>
            </div>
        )
    }

    if (currentStatus === "REVOKED") {
        return (
            <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                    <XCircle className="w-6 h-6 text-red-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Verification Revoked</h2>
                </div>
                <p className="text-slate-600 mb-4">
                    {doctorName}&apos;s verification has been revoked. They cannot review cases.
                </p>
                <button
                    onClick={() => handleAction("verify")}
                    disabled={isLoading}
                    className="btn btn-primary"
                >
                    {isLoading && actionType === "verify" ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Re-verifying...
                        </>
                    ) : (
                        <>
                            <CheckCircle className="w-4 h-4" />
                            Re-Verify Doctor
                        </>
                    )}
                </button>
            </div>
        )
    }

    // PENDING status
    return (
        <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Verification Actions</h2>
            <p className="text-slate-600 mb-6">
                Review the information above and verify the license with the medical board before approving.
            </p>

            <div className="flex gap-4">
                <button
                    onClick={() => handleAction("verify")}
                    disabled={isLoading}
                    className="btn btn-primary flex-1"
                >
                    {isLoading && actionType === "verify" ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Verifying...
                        </>
                    ) : (
                        <>
                            <CheckCircle className="w-4 h-4" />
                            Approve & Verify
                        </>
                    )}
                </button>

                <button
                    onClick={() => handleAction("revoke")}
                    disabled={isLoading}
                    className="btn bg-red-100 text-red-700 hover:bg-red-200"
                >
                    {isLoading && actionType === "revoke" ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Rejecting...
                        </>
                    ) : (
                        <>
                            <XCircle className="w-4 h-4" />
                            Reject
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
