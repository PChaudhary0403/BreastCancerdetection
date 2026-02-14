"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { AlertTriangle, LogOut, Mail, HeartPulse } from "lucide-react"

export default function SuspendedPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
            <div className="card p-8 max-w-md text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-8 h-8 text-amber-600" />
                </div>

                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mx-auto mb-4">
                    <HeartPulse className="w-6 h-6 text-white" />
                </div>

                <h1 className="text-xl font-bold text-slate-900 mb-2">
                    Account Access Limited
                </h1>

                <p className="text-slate-600 mb-6">
                    Your account is currently not active. This may be because:
                </p>

                <ul className="text-left text-sm text-slate-600 space-y-2 mb-6">
                    <li className="flex items-start gap-2">
                        <span className="text-slate-400">•</span>
                        Your account is pending verification
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-slate-400">•</span>
                        Your account has been temporarily suspended
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-slate-400">•</span>
                        There is an issue that requires attention
                    </li>
                </ul>

                <p className="text-sm text-slate-500 mb-6">
                    If you believe this is an error, please contact support.
                </p>

                <div className="flex flex-col gap-3">
                    <a
                        href="mailto:support@breastscreenai.com"
                        className="btn btn-primary"
                    >
                        <Mail className="w-4 h-4" />
                        Contact Support
                    </a>
                    <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="btn btn-secondary"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    )
}
