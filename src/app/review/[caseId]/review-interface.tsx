"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    ArrowLeft, HeartPulse, FileImage, Eye, EyeOff,
    CheckCircle, AlertCircle, Send, Loader2, Info, MessageCircle
} from "lucide-react"

interface ReviewInterfaceProps {
    caseData: {
        id: string
        status: string
        regionCode: string
        createdAt: string
        patientPseudonymId: string
        images: {
            id: string
            viewPosition: string | null
            laterality: string | null
            storageReference: string
        }[]
    }
    existingReview: {
        id: string
        biradsClassification: number
        clinicalNotes: string | null
        recommendation: string
        aiAgreement: string | null
    } | null
    aiInference: {
        id: string
        riskTier: string
        attentionMapReference: string | null
        shownToDoctor: boolean
    } | null
    doctorId: string
    doctorName: string
}

const BIRADS_OPTIONS = [
    { value: 0, label: "0 - Incomplete", description: "Need additional imaging" },
    { value: 1, label: "1 - Negative", description: "No findings" },
    { value: 2, label: "2 - Benign", description: "Non-cancerous finding" },
    { value: 3, label: "3 - Probably Benign", description: "≤2% chance of cancer" },
    { value: 4, label: "4 - Suspicious", description: "2-95% chance of cancer" },
    { value: 5, label: "5 - Highly Suggestive", description: ">95% chance of cancer" },
    { value: 6, label: "6 - Known Malignancy", description: "Biopsy-proven cancer" },
]

const RECOMMENDATION_OPTIONS = [
    { value: "ROUTINE_SCREENING", label: "Routine Screening", patientMessage: "Continue with regular screening as recommended." },
    { value: "SHORT_TERM_FOLLOWUP", label: "Short-term Follow-up", patientMessage: "A follow-up in 6 months is recommended." },
    { value: "ADDITIONAL_IMAGING", label: "Additional Imaging", patientMessage: "Additional imaging views are needed." },
    { value: "BIOPSY_RECOMMENDED", label: "Biopsy Recommended", patientMessage: "Further evaluation is recommended. Please schedule a follow-up." },
    { value: "IMMEDIATE_REFERRAL", label: "Immediate Referral", patientMessage: "Please contact your healthcare provider promptly." },
]

export default function ReviewInterface({
    caseData,
    existingReview,
    aiInference,
    doctorId,
    doctorName,
}: ReviewInterfaceProps) {
    const router = useRouter()

    // Phase management: Phase 1 = independent review, Phase 2 = with AI assistance
    const [phase, setPhase] = useState<1 | 2>(existingReview ? 2 : 1)
    const [showAIAssistance, setShowAIAssistance] = useState(false)
    const [currentAiInference, setCurrentAiInference] = useState(aiInference)

    // Form state
    const [birads, setBirads] = useState<number | null>(existingReview?.biradsClassification ?? null)
    const [clinicalNotes, setClinicalNotes] = useState(existingReview?.clinicalNotes || "")
    const [recommendation, setRecommendation] = useState(existingReview?.recommendation || "")
    const [aiAgreement, setAiAgreement] = useState<string | null>(existingReview?.aiAgreement || null)

    // UI state
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isRunningAI, setIsRunningAI] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedImage, setSelectedImage] = useState(0)

    const handlePhase1Submit = () => {
        if (birads === null) {
            setError("Please select a BI-RADS classification")
            return
        }
        if (!recommendation) {
            setError("Please select a recommendation")
            return
        }
        setError(null)
        setPhase(2)
        setShowAIAssistance(true)
    }

    const triggerAIAnalysis = async () => {
        setIsRunningAI(true)
        setError(null)
        try {
            const response = await fetch(`/api/inference/${caseData.id}`, {
                method: "POST",
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "AI analysis failed")
            }

            // Refresh AI data
            const aiDataResponse = await fetch(`/api/inference/${caseData.id}`)
            const aiData = await aiDataResponse.json()
            if (aiData.inferences && aiData.inferences.length > 0) {
                setCurrentAiInference(aiData.inferences[0])
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to run AI analysis")
        } finally {
            setIsRunningAI(false)
        }
    }

    const handleFinalSubmit = async () => {
        if (birads === null || !recommendation) {
            setError("Please complete all required fields")
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            const response = await fetch(`/api/review/${caseData.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    biradsClassification: birads,
                    clinicalNotes,
                    recommendation,
                    aiAgreement: currentAiInference ? aiAgreement : null,
                    aiInferenceId: currentAiInference?.id,
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "Failed to submit review")
            }

            router.push("/dashboard/doctor?success=review")
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard/doctor"
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-800 flex items-center justify-center">
                                    <HeartPulse className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-800">Case Review</span>
                                    <span className="ml-2 text-sm text-slate-500 font-mono">
                                        #{caseData.id.slice(-8).toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${phase === 1
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700"
                                }`}>
                                Phase {phase}: {phase === 1 ? "Independent Review" : "AI-Assisted Review"}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Mandatory Chat Notice */}
                <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3 animate-fade-in-up">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                        <MessageCircle className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-indigo-800">
                            Real-time chat is active with the patient for this case
                        </p>
                        <p className="text-xs text-indigo-600 mt-0.5">
                            Communication is mandatory during the screening review process. Use the chat widget in the bottom-right corner.
                        </p>
                    </div>
                </div>
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left: Image Viewer */}
                    <div className="space-y-4">
                        {/* Main Image Display */}
                        <div className="card p-4">
                            <div className="aspect-[3/4] bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center mb-4 relative group">
                                {caseData.images.length > 0 ? (
                                    <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={`/api/images/${caseData.images[selectedImage].id}`}
                                            alt={`${caseData.images[selectedImage].laterality} ${caseData.images[selectedImage].viewPosition}`}
                                            className="w-full h-full object-contain cursor-zoom-in"
                                            onClick={() => window.open(`/api/images/${caseData.images[selectedImage].id}`, '_blank')}
                                        />
                                        <div className="absolute top-4 left-4 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-white text-xs font-mono uppercase">
                                            {caseData.images[selectedImage].laterality} {caseData.images[selectedImage].viewPosition}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center text-slate-400">
                                        <FileImage className="w-16 h-16 mx-auto mb-2" />
                                        <p className="text-sm">No images available</p>
                                    </div>
                                )}
                            </div>

                            {/* Image Thumbnails */}
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {caseData.images.map((img, index) => (
                                    <button
                                        key={img.id}
                                        onClick={() => setSelectedImage(index)}
                                        className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 transition-colors ${selectedImage === index
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-slate-200 hover:border-slate-300"
                                            } flex items-center justify-center`}
                                    >
                                        <div className="text-center">
                                            <p className="text-xs font-medium text-slate-600">
                                                {img.laterality?.charAt(0) || "?"}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {img.viewPosition || "N/A"}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* AI Assistance Panel (Phase 2 only) */}
                        {phase === 2 && (
                            <div className="card p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                        <Info className="w-4 h-4" />
                                        AI Assistance (Advisory Only)
                                    </h3>
                                    {currentAiInference && (
                                        <button
                                            onClick={() => setShowAIAssistance(!showAIAssistance)}
                                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                                        >
                                            {showAIAssistance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            {showAIAssistance ? "Hide" : "Show"}
                                        </button>
                                    )}
                                </div>

                                {!currentAiInference ? (
                                    <div className="p-6 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
                                        <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                        <p className="text-sm text-slate-600 mb-4">
                                            No AI analysis has been performed for this case yet.
                                        </p>
                                        <button
                                            onClick={triggerAIAnalysis}
                                            disabled={isRunningAI}
                                            className="btn btn-secondary w-full"
                                        >
                                            {isRunningAI ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Analyzing Images...
                                                </>
                                            ) : (
                                                "Run AI Analysis"
                                            )}
                                        </button>
                                    </div>
                                ) : showAIAssistance ? (
                                    <div className="space-y-4">
                                        {/* Risk Tier */}
                                        <div className={`p-4 rounded-lg border ${currentAiInference.riskTier === "LOW" ? "risk-low" :
                                            currentAiInference.riskTier === "MODERATE" ? "risk-moderate" :
                                                currentAiInference.riskTier === "ELEVATED" ? "risk-elevated" :
                                                    "risk-high"
                                            }`}>
                                            <p className="text-sm font-medium">AI Risk Tier Assessment</p>
                                            <p className="text-lg font-bold">{currentAiInference.riskTier}</p>
                                        </div>

                                        {/* Attention Map Reference */}
                                        {currentAiInference.attentionMapReference && (
                                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                <p className="text-sm font-medium text-slate-700 mb-2">
                                                    Attention Regions
                                                </p>
                                                <div className="aspect-square bg-slate-900 rounded overflow-hidden">
                                                    {/* In production, serve the attention map image */}
                                                    <img
                                                        src={`/api/images/${currentAiInference.attentionMapReference}`}
                                                        alt="AI Attention Map"
                                                        className="w-full h-full object-contain opacity-70"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* AI Agreement Selection */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Do you agree with the AI assessment?
                                            </label>
                                            <div className="flex gap-2">
                                                {["AGREE", "PARTIAL", "DISAGREE"].map((option) => (
                                                    <button
                                                        key={option}
                                                        onClick={() => setAiAgreement(option)}
                                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${aiAgreement === option
                                                            ? option === "AGREE" ? "bg-green-100 text-green-700 border-2 border-green-300" :
                                                                option === "PARTIAL" ? "bg-amber-100 text-amber-700 border-2 border-amber-300" :
                                                                    "bg-red-100 text-red-700 border-2 border-red-300"
                                                            : "bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200"
                                                            }`}
                                                    >
                                                        {option}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="text-xs text-slate-500 p-3 bg-blue-50 rounded-lg">
                                            <strong>Note:</strong> AI assistance is advisory only. Your clinical judgment
                                            is the final authority. Disagreements are logged for model improvement.
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500 text-center py-4 italic">
                                        AI assistance is hidden. Re-enable to see predictions.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Assessment Form */}
                    <div className="space-y-4">
                        {/* BI-RADS Selection */}
                        <div className="card p-6">
                            <h3 className="font-semibold text-slate-900 mb-4">BI-RADS Classification</h3>
                            <div className="space-y-2">
                                {BIRADS_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setBirads(option.value)}
                                        className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${birads === option.value
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-slate-200 hover:border-slate-300"
                                            }`}
                                    >
                                        <p className="font-medium text-slate-900">{option.label}</p>
                                        <p className="text-sm text-slate-500">{option.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Recommendation */}
                        <div className="card p-6">
                            <h3 className="font-semibold text-slate-900 mb-4">Recommendation</h3>
                            <div className="space-y-2">
                                {RECOMMENDATION_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setRecommendation(option.value)}
                                        className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${recommendation === option.value
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-slate-200 hover:border-slate-300"
                                            }`}
                                    >
                                        <p className="font-medium text-slate-900">{option.label}</p>
                                        <p className="text-sm text-slate-500">{option.patientMessage}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Clinical Notes */}
                        <div className="card p-6">
                            <h3 className="font-semibold text-slate-900 mb-4">Clinical Notes (Optional)</h3>
                            <textarea
                                value={clinicalNotes}
                                onChange={(e) => setClinicalNotes(e.target.value)}
                                placeholder="Enter any additional clinical observations..."
                                className="input min-h-[120px] resize-y"
                            />
                        </div>

                        {/* Error Display */}
                        {error && (
                            <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="card p-6">
                            {phase === 1 ? (
                                <button
                                    onClick={handlePhase1Submit}
                                    className="btn btn-primary w-full"
                                    disabled={birads === null || !recommendation}
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    Complete Initial Assessment
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-sm text-slate-600 text-center mb-4">
                                        Review complete. Submit your final assessment below.
                                    </p>
                                    <button
                                        onClick={handleFinalSubmit}
                                        disabled={isSubmitting}
                                        className="btn btn-primary w-full"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-5 h-5" />
                                                Submit Final Review
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setPhase(1)}
                                        className="btn btn-secondary w-full"
                                    >
                                        Revise Assessment
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Doctor Authority Notice */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                        <strong>Your Judgment is Final:</strong> As the reviewing physician, your clinical
                        assessment is the authoritative decision for this case. AI assistance is provided
                        only after your initial assessment and serves as a secondary opinion.
                    </p>
                </div>
            </main>
        </div>
    )
}
