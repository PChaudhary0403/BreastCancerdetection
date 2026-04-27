"use client"

import { useState, useRef, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { HeartPulse, Mail, Lock, AlertCircle, Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react"

function FloatingOrbs() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            <div
                className="absolute w-80 h-80 rounded-full float-animation"
                style={{
                    top: "5%",
                    right: "-15%",
                    background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
                }}
            />
            <div
                className="absolute w-96 h-96 rounded-full float-animation-delayed"
                style={{
                    bottom: "-10%",
                    left: "-15%",
                    background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
                }}
            />
            <div
                className="absolute w-64 h-64 rounded-full"
                style={{
                    top: "50%",
                    left: "60%",
                    background: "radial-gradient(circle, rgba(168,85,247,0.04) 0%, transparent 70%)",
                    animation: "float 10s ease-in-out infinite reverse",
                }}
            />
        </div>
    )
}

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
    const error = searchParams.get("error")

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState(error || "")
    const [mounted, setMounted] = useState(false)
    const [emailFocused, setEmailFocused] = useState(false)
    const [passwordFocused, setPasswordFocused] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setErrorMessage("")

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            })

            if (result?.error) {
                setErrorMessage(result.error)
            } else {
                router.push(callbackUrl)
                router.refresh()
            }
        } catch {
            setErrorMessage("An unexpected error occurred. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center px-4 py-12 animated-gradient-bg relative overflow-hidden">
            <FloatingOrbs />

            <div className={`w-full max-w-md relative z-10 transition-all duration-700 ${mounted ? "animate-fade-in-up" : "opacity-0"}`}>
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center gap-3 group">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 transition-all duration-300 group-hover:scale-110 group-hover:shadow-blue-500/40 group-hover:rotate-3">
                            <HeartPulse className="w-6 h-6 text-white heartbeat" />
                        </div>
                        <span className="text-xl font-semibold text-slate-800">
                            BreastScreen<span className="text-blue-600">AI</span>
                        </span>
                    </Link>
                </div>

                {/* Login Card */}
                <div className="card-glass p-8 shadow-xl shadow-black/[0.03]">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-slate-900 mb-1">
                            Welcome Back
                        </h1>
                        <p className="text-sm text-slate-500">
                            Sign in to access your account
                        </p>
                    </div>

                    {/* Error Message */}
                    {errorMessage && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50/80 border border-red-200 mb-6 animate-fade-in-down backdrop-blur-sm">
                            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                            <p className="text-sm text-red-700">{errorMessage}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="email"
                                className={`label transition-colors duration-200 ${emailFocused ? "text-blue-600" : ""}`}
                            >
                                Email Address
                            </label>
                            <div className="relative group">
                                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ${emailFocused ? "text-blue-500" : "text-slate-400"}`} />
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onFocus={() => setEmailFocused(true)}
                                    onBlur={() => setEmailFocused(false)}
                                    className="input pl-10 bg-white/50 backdrop-blur-sm"
                                    placeholder="you@example.com"
                                    required
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="password"
                                className={`label transition-colors duration-200 ${passwordFocused ? "text-blue-600" : ""}`}
                            >
                                Password
                            </label>
                            <div className="relative group">
                                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ${passwordFocused ? "text-blue-500" : "text-slate-400"}`} />
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onFocus={() => setPasswordFocused(true)}
                                    onBlur={() => setPasswordFocused(false)}
                                    className="input pl-10 pr-10 bg-white/50 backdrop-blur-sm"
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all duration-200 hover:scale-110"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-5 h-5" />
                                    ) : (
                                        <Eye className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn btn-primary btn-shimmer w-full py-3 text-base shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
                        >
                            {isLoading ? (
                                <>
                                    <span className="spinner" />
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <>
                                    <span>Sign In</span>
                                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-6">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-xs text-slate-400 font-medium">OR</span>
                        <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    {/* Google Login Button */}
                    <button
                        type="button"
                        onClick={() => signIn("google", { callbackUrl })}
                        className="w-full py-3 text-base mb-6 rounded-lg font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span>Continue with Google</span>
                    </button>

                    {/* Register Link */}
                    <p className="text-center text-sm text-slate-600">
                        Don&apos;t have an account?{" "}
                        <Link
                            href="/auth/register"
                            className="font-medium text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center gap-1 hover:gap-2"
                        >
                            Register here
                            <ArrowRight className="w-3 h-3" />
                        </Link>
                    </p>
                </div>

                {/* Disclaimer */}
                <p className="text-center text-xs text-slate-400 mt-6 max-w-sm mx-auto leading-relaxed">
                    By signing in, you agree to our terms of service and acknowledge that
                    this is a research support tool, not a diagnostic device.
                </p>
            </div>
        </main>
    )
}
