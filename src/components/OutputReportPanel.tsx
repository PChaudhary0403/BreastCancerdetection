"use client"

import { useState, useEffect } from "react"
import {
    FileBarChart2, TrendingUp, Shield, ChevronDown, ChevronUp,
    Activity, Clock, AlertTriangle, CheckCircle, Loader2,
    Brain, Target, Microscope, BarChart3, Eye
} from "lucide-react"

interface AIInferenceData {
    id: string
    riskTier: string
    modelVersion: string
    inferenceTimestamp: string
    confidence: number | null
    malignancyProbability: number | null
    lesionProbability: number | null
    biradsPrediction: number | null
    biradsProbabilities: Record<string, number> | null
}

interface ReportData {
    reviewId: string
    caseId: string
    regionCode: string
    caseStatus: string
    caseCreatedAt: string
    imageCount: number
    images: { id: string; laterality: string | null; viewPosition: string | null }[]
    biradsClassification: number
    recommendation: string
    clinicalNotes: string | null
    aiAgreement: string | null
    reviewCompletedAt: string
    reviewStartedAt: string | null
    aiInference: AIInferenceData | null
}

interface SummaryData {
    totalReports: number
    biradsDistribution: Record<number, number>
    riskTierDistribution: Record<string, number>
    averageConfidence: number | null
    periodDays: number
}

const RECOMMENDATION_LABELS: Record<string, string> = {
    ROUTINE_SCREENING: "Routine Screening",
    SHORT_TERM_FOLLOWUP: "Short-term Follow-up",
    ADDITIONAL_IMAGING: "Additional Imaging",
    BIOPSY_RECOMMENDED: "Biopsy Recommended",
    IMMEDIATE_REFERRAL: "Immediate Referral",
}

const BIRADS_LABELS: Record<number, string> = {
    0: "Incomplete",
    1: "Negative",
    2: "Benign",
    3: "Probably Benign",
    4: "Suspicious",
    5: "Highly Suggestive",
    6: "Known Malignancy",
}

const RISK_TIER_COLORS: Record<string, { bg: string; fill: string; text: string; badge: string }> = {
    LOW: { bg: "#ecfdf5", fill: "#10b981", text: "#047857", badge: "risk-low" },
    MODERATE: { bg: "#fffbeb", fill: "#f59e0b", text: "#b45309", badge: "risk-moderate" },
    ELEVATED: { bg: "#fff7ed", fill: "#f97316", text: "#c2410c", badge: "risk-elevated" },
    HIGH: { bg: "#fef2f2", fill: "#ef4444", text: "#b91c1c", badge: "risk-high" },
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

/** Animated progress bar with label and percentage */
function MetricProgressBar({
    label,
    value,
    maxValue = 100,
    icon: Icon,
    colorFrom,
    colorTo,
    suffix = "%",
    delay = 0,
}: {
    label: string
    value: number | null
    maxValue?: number
    icon: React.ElementType
    colorFrom: string
    colorTo: string
    suffix?: string
    delay?: number
}) {
    const [animated, setAnimated] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setAnimated(true), 100 + delay)
        return () => clearTimeout(timer)
    }, [delay])

    if (value === null || value === undefined) {
        return (
            <div className="report-metric-row">
                <div className="report-metric-label">
                    <Icon className="report-metric-icon" style={{ width: 14, height: 14, color: colorFrom }} />
                    <span>{label}</span>
                </div>
                <div className="report-metric-bar-wrapper">
                    <div className="report-metric-bar">
                        <div className="report-metric-bar-track" />
                    </div>
                    <span className="report-metric-value" style={{ color: "#94a3b8" }}>N/A</span>
                </div>
            </div>
        )
    }

    const percentage = Math.min((value / maxValue) * 100, 100)
    const displayValue = suffix === "%" ? `${Math.round(value * 100)}%` : `${value}${suffix}`

    return (
        <div className="report-metric-row">
            <div className="report-metric-label">
                <Icon className="report-metric-icon" style={{ width: 14, height: 14, color: colorFrom }} />
                <span>{label}</span>
            </div>
            <div className="report-metric-bar-wrapper">
                <div className="report-metric-bar">
                    <div className="report-metric-bar-track" />
                    <div
                        className="report-metric-bar-fill"
                        style={{
                            width: animated ? `${percentage}%` : "0%",
                            background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`,
                            transition: `width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
                        }}
                    />
                </div>
                <span className="report-metric-value" style={{ color: colorFrom }}>
                    {displayValue}
                </span>
            </div>
        </div>
    )
}

/** BI-RADS segmented progress bar (0-6) */
function BiradsProgressBar({ value, aiPrediction }: { value: number; aiPrediction: number | null }) {
    const segments = [0, 1, 2, 3, 4, 5, 6]
    const segmentColors = [
        "#94a3b8", // 0 - Gray (incomplete)
        "#10b981", // 1 - Green
        "#34d399", // 2 - Light green
        "#fbbf24", // 3 - Yellow
        "#f97316", // 4 - Orange
        "#ef4444", // 5 - Red
        "#991b1b", // 6 - Dark red
    ]

    return (
        <div className="report-metric-row">
            <div className="report-metric-label">
                <Shield className="report-metric-icon" style={{ width: 14, height: 14, color: "#6366f1" }} />
                <span>BI-RADS</span>
            </div>
            <div className="report-birads-wrapper">
                <div className="report-birads-segments">
                    {segments.map((seg) => (
                        <div
                            key={seg}
                            className={`report-birads-segment ${seg <= value ? "active" : ""} ${seg === value ? "current" : ""}`}
                            style={{
                                background: seg <= value ? segmentColors[seg] : "#e2e8f0",
                                boxShadow: seg === value ? `0 0 8px ${segmentColors[seg]}60` : "none",
                            }}
                            title={`BI-RADS ${seg}: ${BIRADS_LABELS[seg]}`}
                        >
                            <span className="report-birads-segment-label">{seg}</span>
                        </div>
                    ))}
                </div>
                <div className="report-birads-info">
                    <span className="report-birads-value" style={{ color: segmentColors[value] }}>
                        BI-RADS {value}
                    </span>
                    <span className="report-birads-desc">{BIRADS_LABELS[value]}</span>
                    {aiPrediction !== null && aiPrediction !== value && (
                        <span className="report-birads-ai" title="AI predicted BI-RADS">
                            AI: {aiPrediction}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

/** Individual report card (expandable) */
function ReportCard({ report, index }: { report: ReportData; index: number }) {
    const [expanded, setExpanded] = useState(false)

    const riskColors = report.aiInference?.riskTier
        ? RISK_TIER_COLORS[report.aiInference.riskTier]
        : null

    const recommendationClass =
        report.recommendation === "ROUTINE_SCREENING" || report.recommendation === "SHORT_TERM_FOLLOWUP"
            ? "badge-success"
            : report.recommendation === "ADDITIONAL_IMAGING"
                ? "badge-warning"
                : "badge-danger"

    return (
        <div
            className="report-card animate-fade-in-up"
            style={{ animationDelay: `${100 + index * 60}ms` }}
        >
            {/* Card Header */}
            <button
                className="report-card-header"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                aria-controls={`report-detail-${report.reviewId}`}
            >
                <div className="report-card-header-left">
                    <span className="report-card-case-id">
                        #{report.caseId.slice(-8).toUpperCase()}
                    </span>
                    <span className="report-card-region">{report.regionCode}</span>
                    <div className="report-card-meta">
                        <Clock style={{ width: 12, height: 12 }} />
                        <span>{formatDate(report.reviewCompletedAt)}</span>
                    </div>
                </div>
                <div className="report-card-header-right">
                    {/* Quick BI-RADS badge */}
                    <span
                        className="report-card-birads-badge"
                        style={{
                            background:
                                report.biradsClassification <= 2
                                    ? "#dcfce7"
                                    : report.biradsClassification <= 3
                                        ? "#fef3c7"
                                        : report.biradsClassification <= 4
                                            ? "#fed7aa"
                                            : "#fecaca",
                            color:
                                report.biradsClassification <= 2
                                    ? "#166534"
                                    : report.biradsClassification <= 3
                                        ? "#92400e"
                                        : report.biradsClassification <= 4
                                            ? "#c2410c"
                                            : "#991b1b",
                        }}
                    >
                        BI-RADS {report.biradsClassification}
                    </span>
                    {/* Risk tier */}
                    {riskColors && (
                        <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${riskColors.badge}`}
                        >
                            {report.aiInference!.riskTier}
                        </span>
                    )}
                    {/* Recommendation */}
                    <span className={`badge ${recommendationClass}`}>
                        {RECOMMENDATION_LABELS[report.recommendation] || report.recommendation}
                    </span>
                    {/* Expand toggle */}
                    <div className="report-card-expand-icon">
                        {expanded ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
                    </div>
                </div>
            </button>

            {/* Expandable Detail */}
            <div
                id={`report-detail-${report.reviewId}`}
                className={`report-card-detail ${expanded ? "expanded" : ""}`}
            >
                <div className="report-card-detail-inner">
                    {/* Progress Bars Section */}
                    <div className="report-metrics-grid">
                        {/* Left: BI-RADS + Metrics */}
                        <div className="report-metrics-col">
                            <h4 className="report-metrics-section-title">
                                <Activity style={{ width: 14, height: 14 }} />
                                Mammogram Analysis
                            </h4>

                            <BiradsProgressBar
                                value={report.biradsClassification}
                                aiPrediction={report.aiInference?.biradsPrediction ?? null}
                            />

                            <MetricProgressBar
                                label="AI Confidence"
                                value={report.aiInference?.confidence ?? null}
                                icon={Brain}
                                colorFrom="#06b6d4"
                                colorTo="#10b981"
                                delay={100}
                            />

                            <MetricProgressBar
                                label="Malignancy Prob."
                                value={report.aiInference?.malignancyProbability ?? null}
                                icon={AlertTriangle}
                                colorFrom="#f59e0b"
                                colorTo="#ef4444"
                                delay={200}
                            />

                            <MetricProgressBar
                                label="Lesion Prob."
                                value={report.aiInference?.lesionProbability ?? null}
                                icon={Target}
                                colorFrom="#3b82f6"
                                colorTo="#f97316"
                                delay={300}
                            />
                        </div>

                        {/* Right: Details */}
                        <div className="report-metrics-col">
                            <h4 className="report-metrics-section-title">
                                <Microscope style={{ width: 14, height: 14 }} />
                                Review Details
                            </h4>

                            <div className="report-detail-list">
                                <div className="report-detail-item">
                                    <span className="report-detail-key">Images</span>
                                    <span className="report-detail-val">
                                        <Eye style={{ width: 12, height: 12 }} />
                                        {report.imageCount} view{report.imageCount !== 1 ? "s" : ""}
                                    </span>
                                </div>

                                <div className="report-detail-item">
                                    <span className="report-detail-key">Case Submitted</span>
                                    <span className="report-detail-val">{formatDate(report.caseCreatedAt)}</span>
                                </div>

                                {report.reviewStartedAt && (
                                    <div className="report-detail-item">
                                        <span className="report-detail-key">Review Started</span>
                                        <span className="report-detail-val">{formatDate(report.reviewStartedAt)}</span>
                                    </div>
                                )}

                                <div className="report-detail-item">
                                    <span className="report-detail-key">AI Agreement</span>
                                    <span className="report-detail-val">
                                        {report.aiAgreement ? (
                                            <span
                                                className={`badge text-xs ${report.aiAgreement === "AGREE"
                                                    ? "badge-success"
                                                    : report.aiAgreement === "PARTIAL"
                                                        ? "badge-warning"
                                                        : "badge-danger"
                                                    }`}
                                            >
                                                {report.aiAgreement}
                                            </span>
                                        ) : (
                                            <span style={{ color: "#94a3b8", fontStyle: "italic" }}>N/A</span>
                                        )}
                                    </span>
                                </div>

                                {report.aiInference?.modelVersion && (
                                    <div className="report-detail-item">
                                        <span className="report-detail-key">Model Version</span>
                                        <span className="report-detail-val report-detail-mono">
                                            {report.aiInference.modelVersion}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {report.clinicalNotes && (
                                <div className="report-clinical-notes">
                                    <p className="report-clinical-notes-label">Clinical Notes</p>
                                    <p className="report-clinical-notes-text">{report.clinicalNotes}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BI-RADS Probabilities Distribution (if AI data available) */}
                    {report.aiInference?.biradsProbabilities && (
                        <div className="report-birads-probs">
                            <h4 className="report-metrics-section-title">
                                <BarChart3 style={{ width: 14, height: 14 }} />
                                AI BI-RADS Probability Distribution
                            </h4>
                            <div className="report-birads-prob-bars">
                                {Object.entries(report.aiInference.biradsProbabilities).map(([key, prob]) => (
                                    <div key={key} className="report-birads-prob-item">
                                        <span className="report-birads-prob-label">{key}</span>
                                        <div className="report-birads-prob-bar">
                                            <div
                                                className="report-birads-prob-fill"
                                                style={{
                                                    width: `${Math.round(prob * 100)}%`,
                                                    background: `linear-gradient(90deg, #818cf8, #6366f1)`,
                                                }}
                                            />
                                        </div>
                                        <span className="report-birads-prob-value">{Math.round(prob * 100)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/** Summary statistics dashboard */
function SummaryPanel({ summary }: { summary: SummaryData }) {
    const totalRiskCases = Object.values(summary.riskTierDistribution).reduce((a, b) => a + b, 0)

    return (
        <div className="report-summary-grid">
            {/* Total Reports */}
            <div className="report-summary-card animate-fade-in-up" style={{ animationDelay: "100ms" }}>
                <div className="report-summary-icon" style={{ background: "#ede9fe" }}>
                    <FileBarChart2 style={{ width: 20, height: 20, color: "#7c3aed" }} />
                </div>
                <div>
                    <p className="report-summary-value">{summary.totalReports}</p>
                    <p className="report-summary-label">Total Reports</p>
                    <p className="report-summary-sub">Last {summary.periodDays} days</p>
                </div>
            </div>

            {/* Average Confidence */}
            <div className="report-summary-card animate-fade-in-up" style={{ animationDelay: "200ms" }}>
                <div className="report-summary-icon" style={{ background: "#d1fae5" }}>
                    <Brain style={{ width: 20, height: 20, color: "#059669" }} />
                </div>
                <div>
                    <p className="report-summary-value">
                        {summary.averageConfidence !== null
                            ? `${Math.round(summary.averageConfidence * 100)}%`
                            : "N/A"}
                    </p>
                    <p className="report-summary-label">Avg. AI Confidence</p>
                    <p className="report-summary-sub">Model accuracy indicator</p>
                </div>
            </div>

            {/* Risk Distribution */}
            <div className="report-summary-card report-summary-card-wide animate-fade-in-up" style={{ animationDelay: "300ms" }}>
                <div className="report-summary-icon" style={{ background: "#fee2e2" }}>
                    <TrendingUp style={{ width: 20, height: 20, color: "#dc2626" }} />
                </div>
                <div style={{ flex: 1 }}>
                    <p className="report-summary-label" style={{ marginBottom: 8 }}>Risk Tier Distribution</p>
                    {totalRiskCases > 0 ? (
                        <>
                            <div className="report-risk-stacked-bar">
                                {(["LOW", "MODERATE", "ELEVATED", "HIGH"] as const).map((tier) => {
                                    const count = summary.riskTierDistribution[tier] || 0
                                    const pct = (count / totalRiskCases) * 100
                                    if (pct === 0) return null
                                    return (
                                        <div
                                            key={tier}
                                            className="report-risk-stacked-segment"
                                            style={{
                                                width: `${pct}%`,
                                                background: RISK_TIER_COLORS[tier].fill,
                                            }}
                                            title={`${tier}: ${count} (${Math.round(pct)}%)`}
                                        />
                                    )
                                })}
                            </div>
                            <div className="report-risk-legend">
                                {(["LOW", "MODERATE", "ELEVATED", "HIGH"] as const).map((tier) => {
                                    const count = summary.riskTierDistribution[tier] || 0
                                    if (count === 0) return null
                                    return (
                                        <div key={tier} className="report-risk-legend-item">
                                            <span
                                                className="report-risk-legend-dot"
                                                style={{ background: RISK_TIER_COLORS[tier].fill }}
                                            />
                                            <span>{tier}: {count}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    ) : (
                        <p style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>No AI data available</p>
                    )}
                </div>
            </div>

            {/* BI-RADS Distribution */}
            <div className="report-summary-card report-summary-card-wide animate-fade-in-up" style={{ animationDelay: "400ms" }}>
                <div className="report-summary-icon" style={{ background: "#dbeafe" }}>
                    <Shield style={{ width: 20, height: 20, color: "#2563eb" }} />
                </div>
                <div style={{ flex: 1 }}>
                    <p className="report-summary-label" style={{ marginBottom: 8 }}>BI-RADS Distribution</p>
                    {summary.totalReports > 0 ? (
                        <div className="report-birads-dist">
                            {[0, 1, 2, 3, 4, 5, 6].map((b) => {
                                const count = summary.biradsDistribution[b] || 0
                                const pct = (count / summary.totalReports) * 100
                                return (
                                    <div key={b} className="report-birads-dist-item">
                                        <span className="report-birads-dist-label">{b}</span>
                                        <div className="report-birads-dist-bar">
                                            <div
                                                className="report-birads-dist-fill"
                                                style={{
                                                    width: `${pct}%`,
                                                    background:
                                                        b <= 2 ? "#10b981" : b <= 3 ? "#fbbf24" : b <= 4 ? "#f97316" : "#ef4444",
                                                }}
                                            />
                                        </div>
                                        <span className="report-birads-dist-count">{count}</span>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <p style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>No reports yet</p>
                    )}
                </div>
            </div>
        </div>
    )
}

/** Main Output Report Panel */
export default function OutputReportPanel() {
    const [reports, setReports] = useState<ReportData[]>([])
    const [summary, setSummary] = useState<SummaryData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [days, setDays] = useState(30)

    const fetchReports = async (periodDays: number) => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(`/api/cases/reports?days=${periodDays}&limit=50`)
            if (!response.ok) {
                throw new Error("Failed to fetch reports")
            }
            const data = await response.json()
            setReports(data.reports)
            setSummary(data.summary)
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchReports(days)
    }, [days])

    return (
        <div className="report-panel">
            {/* Panel Header */}
            <div className="report-panel-header">
                <div className="report-panel-title-row">
                    <h2 className="report-panel-title">
                        <FileBarChart2 style={{ width: 20, height: 20, color: "#6366f1" }} />
                        Completed Reports &amp; Analysis
                    </h2>
                    {/* Period Selector */}
                    <div className="report-period-selector">
                        {[7, 30, 90].map((d) => (
                            <button
                                key={d}
                                onClick={() => setDays(d)}
                                className={`report-period-btn ${days === d ? "active" : ""}`}
                            >
                                {d}d
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="report-loading">
                    <Loader2 className="report-loading-spinner" style={{ width: 24, height: 24 }} />
                    <p>Loading reports...</p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="report-error">
                    <AlertTriangle style={{ width: 16, height: 16 }} />
                    <p>{error}</p>
                    <button onClick={() => fetchReports(days)} className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }}>
                        Retry
                    </button>
                </div>
            )}

            {/* Content */}
            {!loading && !error && (
                <>
                    {/* Summary Statistics */}
                    {summary && <SummaryPanel summary={summary} />}

                    {/* Reports List */}
                    <div className="report-list">
                        {reports.length === 0 ? (
                            <div className="report-empty">
                                <CheckCircle style={{ width: 40, height: 40, color: "#94a3b8" }} />
                                <p className="report-empty-title">No completed reports</p>
                                <p className="report-empty-sub">
                                    Completed case reviews will appear here with detailed analysis progress.
                                </p>
                            </div>
                        ) : (
                            reports.map((report, index) => (
                                <ReportCard key={report.reviewId} report={report} index={index} />
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
