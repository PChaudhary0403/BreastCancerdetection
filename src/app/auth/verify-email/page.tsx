"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { HeartPulse, CheckCircle, XCircle, Loader2 } from "lucide-react"

function VerifyEmailContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const token = searchParams.get("token")
    
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
    const [message, setMessage] = useState("")

    useEffect(() => {
        if (!token) {
            setStatus("error")
            setMessage("Invalid verification link. The link might be malformed.")
            return
        }

        const verifyToken = async () => {
            try {
                const response = await fetch("/api/auth/verify-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token })
                })

                const data = await response.json()

                if (response.ok) {
                    setStatus("success")
                    setMessage(data.message)
                    // Optionally redirect to login after a few seconds
                    setTimeout(() => {
                        router.push("/auth/login")
                    }, 3000)
                } else {
                    setStatus("error")
                    setMessage(data.error || "Verification failed")
                }
            } catch (error) {
                setStatus("error")
                setMessage("An unexpected error occurred while verifying.")
            }
        }

        verifyToken()
    }, [token, router])

    return (
        <div className="card-glass p-8 shadow-xl max-w-md w-full text-center mx-4">
            <div className="flex justify-center mb-6">
                <Link href="/" className="inline-flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <HeartPulse className="w-6 h-6 text-white" />
                    </div>
                </Link>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Email Verification
            </h1>

            <div className="py-8 flex flex-col items-center justify-center min-h-[150px]">
                {status === "loading" && (
                    <div className="flex flex-col items-center animate-fade-in">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                        <p className="text-slate-600">Verifying your email address...</p>
                    </div>
                )}

                {status === "success" && (
                    <div className="flex flex-col items-center animate-scale-in">
                        <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                        <p className="text-green-700 font-medium">{message}</p>
                        <p className="text-sm text-slate-500 mt-2">Redirecting to login...</p>
                    </div>
                )}

                {status === "error" && (
                    <div className="flex flex-col items-center animate-fade-in-up">
                        <XCircle className="w-12 h-12 text-red-500 mb-4" />
                        <p className="text-red-700 font-medium">{message}</p>
                        <Link 
                            href="/auth/login" 
                            className="mt-6 text-blue-600 hover:text-blue-700 font-medium text-sm"
                        >
                            Return to Login
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function VerifyEmailPage() {
    return (
        <main className="min-h-screen flex items-center justify-center animated-gradient-bg relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute w-80 h-80 rounded-full float-animation bg-blue-100/30" style={{ top: "10%", left: "-10%" }} />
                <div className="absolute w-96 h-96 rounded-full float-animation-delayed bg-indigo-100/30" style={{ bottom: "-10%", right: "-10%" }} />
            </div>

            <div className="relative z-10 w-full flex justify-center">
                <Suspense fallback={<div className="p-8 text-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto"/></div>}>
                    <VerifyEmailContent />
                </Suspense>
            </div>
        </main>
    )
}
