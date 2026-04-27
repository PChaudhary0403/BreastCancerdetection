"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import Link from "next/link"
import {
    HeartPulse, Mail, Lock, User, MapPin,
    AlertCircle, Eye, EyeOff, CheckCircle,
    Shield, Stethoscope, Calendar, ArrowRight, Sparkles, Phone
} from "lucide-react"

type RegistrationType = "patient" | "doctor"

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
        </div>
    )
}

function PasswordStrengthMeter({ password }: { password: string }) {
    const getStrength = (pwd: string) => {
        let score = 0
        if (pwd.length >= 8) score++
        if (/[A-Z]/.test(pwd)) score++
        if (/[a-z]/.test(pwd)) score++
        if (/[0-9]/.test(pwd)) score++
        if (/[^A-Za-z0-9]/.test(pwd)) score++
        return score
    }

    const strength = getStrength(password)
    const labels = ["", "Very Weak", "Weak", "Fair", "Strong", "Very Strong"]
    const colors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#059669"]
    const widths = ["0%", "20%", "40%", "60%", "80%", "100%"]

    if (!password) return null

    return (
        <div className="mt-2 space-y-1">
            <div className="progress-bar">
                <div
                    className="progress-bar-fill"
                    style={{
                        width: widths[strength],
                        background: colors[strength],
                    }}
                />
            </div>
            <p className="text-xs font-medium" style={{ color: colors[strength] }}>
                {labels[strength]}
            </p>
        </div>
    )
}

export default function RegisterPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const initialType = searchParams.get("type") === "doctor" ? "doctor" : "patient"

    const [registrationType, setRegistrationType] = useState<RegistrationType>(initialType)
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState("")
    const [successMessage, setSuccessMessage] = useState("")
    const [mounted, setMounted] = useState(false)

    // Patient fields
    const [email, setEmail] = useState("")
    const [phoneNumber, setPhoneNumber] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [name, setName] = useState("")
    const [regionCode, setRegionCode] = useState("")
    const [consentAccepted, setConsentAccepted] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    // Doctor additional fields
    const [licenseNumber, setLicenseNumber] = useState("")
    const [licenseExpiry, setLicenseExpiry] = useState("")
    const [specialty, setSpecialty] = useState("")
    const [assignedRegions, setAssignedRegions] = useState<string[]>([])

    // Focus states
    const [focusedField, setFocusedField] = useState<string | null>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setErrorMessage("")
        setSuccessMessage("")

        // Validate password match
        if (password !== confirmPassword) {
            setErrorMessage("Passwords do not match")
            setIsLoading(false)
            return
        }

        try {
            const payload = registrationType === "patient"
                ? {
                    type: "patient",
                    email,
                    phoneNumber,
                    password,
                    name,
                    regionCode,
                    consentAccepted,
                }
                : {
                    type: "doctor",
                    email,
                    phoneNumber,
                    password,
                    name,
                    licenseNumber,
                    licenseExpiry,
                    specialty,
                    assignedRegions: assignedRegions.length ? assignedRegions : [regionCode],
                }

            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const data = await response.json()

            if (!response.ok) {
                setErrorMessage(data.error || "Registration failed")
            } else {
                setSuccessMessage(data.message)
                setTimeout(() => {
                    router.push("/auth/login")
                }, 2000)
            }
        } catch {
            setErrorMessage("An unexpected error occurred. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    const inputClass = (field: string) =>
        `input pl-10 bg-white/50 backdrop-blur-sm ${focusedField === field ? "border-blue-400" : ""}`

    const labelClass = (field: string) =>
        `label transition-colors duration-200 ${focusedField === field ? "text-blue-600" : ""}`

    const iconClass = (field: string) =>
        `absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ${focusedField === field ? "text-blue-500" : "text-slate-400"}`

    return (
        <main className="min-h-screen flex items-center justify-center px-4 py-12 animated-gradient-bg relative overflow-hidden">
            <FloatingOrbs />

            <div className={`w-full max-w-lg relative z-10 transition-all duration-700 ${mounted ? "animate-fade-in-up" : "opacity-0"}`}>
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

                {/* Registration Card */}
                <div className="card-glass p-8 shadow-xl shadow-black/[0.03]">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-slate-900 mb-1">
                            Create Account
                        </h1>
                        <p className="text-sm text-slate-500">
                            Join our clinician-verified screening platform
                        </p>
                    </div>

                    {/* Type Toggle - Enhanced with sliding background */}
                    <div className="relative flex gap-1 p-1 bg-slate-100/80 backdrop-blur-sm rounded-xl mb-6">
                        <div
                            className="absolute top-1 bottom-1 bg-white rounded-lg shadow-sm transition-all duration-300 ease-out"
                            style={{
                                left: registrationType === "patient" ? "4px" : "50%",
                                width: "calc(50% - 4px)",
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setRegistrationType("patient")}
                            className={`relative z-10 flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${registrationType === "patient"
                                    ? "text-slate-900"
                                    : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            <User className="w-4 h-4" />
                            Patient
                        </button>
                        <button
                            type="button"
                            onClick={() => setRegistrationType("doctor")}
                            className={`relative z-10 flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${registrationType === "doctor"
                                    ? "text-slate-900"
                                    : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            <Stethoscope className="w-4 h-4" />
                            Doctor
                        </button>
                    </div>

                    {/* Success Message */}
                    {successMessage && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50/80 border border-green-200 mb-6 animate-scale-in backdrop-blur-sm">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-green-800">{successMessage}</p>
                                <p className="text-xs text-green-600 mt-0.5">Redirecting to login...</p>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {errorMessage && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50/80 border border-red-200 mb-6 animate-fade-in-down backdrop-blur-sm">
                            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                            <p className="text-sm text-red-700">{errorMessage}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name */}
                        <div>
                            <label htmlFor="name" className={labelClass("name")}>Full Name</label>
                            <div className="relative">
                                <User className={iconClass("name")} />
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    onFocus={() => setFocusedField("name")}
                                    onBlur={() => setFocusedField(null)}
                                    className={inputClass("name")}
                                    placeholder={registrationType === "doctor" ? "Dr. Jane Smith" : "Jane Smith"}
                                    required
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label htmlFor="email" className={labelClass("email")}>Email Address</label>
                            <div className="relative">
                                <Mail className={iconClass("email")} />
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onFocus={() => setFocusedField("email")}
                                    onBlur={() => setFocusedField(null)}
                                    className={inputClass("email")}
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>
                        </div>

                        {/* Phone Number */}
                        <div>
                            <label htmlFor="phone" className={labelClass("phone")}>Phone Number</label>
                            <div className="relative">
                                <Phone className={iconClass("phone")} />
                                <input
                                    id="phone"
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    onFocus={() => setFocusedField("phone")}
                                    onBlur={() => setFocusedField(null)}
                                    className={inputClass("phone")}
                                    placeholder="+1234567890"
                                    required
                                    pattern="^\+?[1-9]\d{1,14}$"
                                />
                            </div>
                        </div>

                        {/* Region */}
                        <div>
                            <label htmlFor="region" className={labelClass("region")}>Region</label>
                            <div className="relative">
                                <MapPin className={iconClass("region")} />
                                <select
                                    id="region"
                                    value={regionCode}
                                    onChange={(e) => setRegionCode(e.target.value)}
                                    onFocus={() => setFocusedField("region")}
                                    onBlur={() => setFocusedField(null)}
                                    className={inputClass("region")}
                                    required
                                >
                                    <option value="">Select your region</option>
                                    <option value="NORTH">North Region</option>
                                    <option value="SOUTH">South Region</option>
                                    <option value="EAST">East Region</option>
                                    <option value="WEST">West Region</option>
                                    <option value="CENTRAL">Central Region</option>
                                    <option value="RURAL">Rural Areas</option>
                                </select>
                            </div>
                        </div>

                        {/* Doctor-specific fields - Animated */}
                        <div
                            className={`space-y-4 overflow-hidden transition-all duration-500 ease-out ${registrationType === "doctor"
                                    ? "max-h-[500px] opacity-100"
                                    : "max-h-0 opacity-0"
                                }`}
                        >
                            {/* Section header for doctor fields */}
                            <div className="flex items-center gap-2 pt-2">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-indigo-200" />
                                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Medical Credentials</span>
                                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-indigo-200" />
                            </div>

                            <div>
                                <label htmlFor="license" className={labelClass("license")}>Medical License Number</label>
                                <div className="relative">
                                    <Shield className={iconClass("license")} />
                                    <input
                                        id="license"
                                        type="text"
                                        value={licenseNumber}
                                        onChange={(e) => setLicenseNumber(e.target.value)}
                                        onFocus={() => setFocusedField("license")}
                                        onBlur={() => setFocusedField(null)}
                                        className={inputClass("license")}
                                        placeholder="MED-XXXX-XXXX"
                                        required={registrationType === "doctor"}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="expiry" className={labelClass("expiry")}>License Expiry Date</label>
                                <div className="relative">
                                    <Calendar className={iconClass("expiry")} />
                                    <input
                                        id="expiry"
                                        type="date"
                                        value={licenseExpiry}
                                        onChange={(e) => setLicenseExpiry(e.target.value)}
                                        onFocus={() => setFocusedField("expiry")}
                                        onBlur={() => setFocusedField(null)}
                                        className={inputClass("expiry")}
                                        required={registrationType === "doctor"}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="specialty" className={labelClass("specialty")}>Specialty</label>
                                <div className="relative">
                                    <Stethoscope className={iconClass("specialty")} />
                                    <select
                                        id="specialty"
                                        value={specialty}
                                        onChange={(e) => setSpecialty(e.target.value)}
                                        onFocus={() => setFocusedField("specialty")}
                                        onBlur={() => setFocusedField(null)}
                                        className={inputClass("specialty")}
                                        required={registrationType === "doctor"}
                                    >
                                        <option value="">Select specialty</option>
                                        <option value="Radiology">Radiology</option>
                                        <option value="Breast Imaging">Breast Imaging</option>
                                        <option value="Oncology">Oncology</option>
                                        <option value="General Surgery">General Surgery</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className={labelClass("password")}>Password</label>
                            <div className="relative">
                                <Lock className={iconClass("password")} />
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onFocus={() => setFocusedField("password")}
                                    onBlur={() => setFocusedField(null)}
                                    className={`${inputClass("password")} pr-10`}
                                    placeholder="••••••••"
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all duration-200 hover:scale-110"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            <PasswordStrengthMeter password={password} />
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label htmlFor="confirmPassword" className={labelClass("confirmPassword")}>Confirm Password</label>
                            <div className="relative">
                                <Lock className={iconClass("confirmPassword")} />
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    onFocus={() => setFocusedField("confirmPassword")}
                                    onBlur={() => setFocusedField(null)}
                                    className={inputClass("confirmPassword")}
                                    placeholder="••••••••"
                                    required
                                />
                                {confirmPassword && password && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {password === confirmPassword ? (
                                            <CheckCircle className="w-5 h-5 text-green-500 animate-scale-in" />
                                        ) : (
                                            <AlertCircle className="w-5 h-5 text-red-400" />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Consent (Patient only) */}
                        <div
                            className={`overflow-hidden transition-all duration-500 ease-out ${registrationType === "patient"
                                    ? "max-h-[200px] opacity-100"
                                    : "max-h-0 opacity-0"
                                }`}
                        >
                            <div className="p-4 bg-slate-50/80 backdrop-blur-sm rounded-xl border border-slate-200 transition-all duration-200 hover:border-slate-300">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <div className="relative mt-0.5">
                                        <input
                                            type="checkbox"
                                            checked={consentAccepted}
                                            onChange={(e) => setConsentAccepted(e.target.checked)}
                                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all duration-200"
                                            required={registrationType === "patient"}
                                        />
                                    </div>
                                    <span className="text-sm text-slate-600 group-hover:text-slate-700 transition-colors">
                                        I understand that this is a <strong>screening support tool</strong>, not a diagnostic
                                        device. All findings will be reviewed by certified medical professionals.
                                        I consent to the secure storage and processing of my medical images.
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Doctor Notice */}
                        <div
                            className={`overflow-hidden transition-all duration-500 ease-out ${registrationType === "doctor"
                                    ? "max-h-[200px] opacity-100"
                                    : "max-h-0 opacity-0"
                                }`}
                        >
                            <div className="p-4 bg-amber-50/80 backdrop-blur-sm rounded-xl border border-amber-200">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                                        <Shield className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <p className="text-sm text-amber-800">
                                        <strong>Note:</strong> Your credentials will be verified by our admin team
                                        before your account is activated. This typically takes 1-2 business days.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn btn-primary btn-shimmer w-full py-3 text-base shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 mt-2"
                        >
                            {isLoading ? (
                                <>
                                    <span className="spinner" />
                                    <span>Creating account...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    <span>Register as {registrationType === "patient" ? "Patient" : "Doctor"}</span>
                                    <ArrowRight className="w-4 h-4" />
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
                        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
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

                    {/* Login Link */}
                    <p className="text-center text-sm text-slate-600">
                        Already have an account?{" "}
                        <Link
                            href="/auth/login"
                            className="font-medium text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center gap-1 hover:gap-2"
                        >
                            Sign in
                            <ArrowRight className="w-3 h-3" />
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    )
}
