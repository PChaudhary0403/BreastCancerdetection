/**
 * ML Service Client for Next.js Platform
 * 
 * Connects the web platform to the Python ML inference service
 * 
 * IMPORTANT: AI outputs are ADVISORY ONLY
 * All predictions must be reviewed by qualified doctors
 */

import { readFromStorage } from "./storage"
import { cacheGet, cacheSet } from "./redis"

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 
    (process.env.NODE_ENV === "production" 
        ? "https://pankaj0403-ml-service.hf.space" 
        : "http://localhost:8000")
const ML_SERVICE_API_KEY = process.env.ML_SERVICE_API_KEY || ""

// Warn at import-time if using insecure defaults
if (!ML_SERVICE_API_KEY) {
    console.warn("[SECURITY] ML_SERVICE_API_KEY is not set. ML service calls will fail.")
} else if (ML_SERVICE_API_KEY === "dev-key") {
    console.warn("[SECURITY] ML_SERVICE_API_KEY is set to the default 'dev-key'. Change this in production.")
}

export interface MLInferenceResult {
    inference_id: string
    case_id: string | null
    timestamp: string
    risk_tier: "LOW" | "MODERATE" | "ELEVATED" | "HIGH"
    birads_prediction: number
    birads_probabilities: Record<string, number>
    confidence: number
    malignancy_probability: number
    lesion_probability: number
    attention_map_reference: string | null
    model_version: string
    advisory_notice: string
}

export interface MLServiceHealth {
    status: string
    model_loaded: boolean
    model_version: string | null
    device: string
}

/**
 * Check if ML service is healthy.
 * Cached in Redis for 30 seconds to reduce load.
 */
export async function checkMLServiceHealth(): Promise<MLServiceHealth> {
    const CACHE_KEY = "ml:health"
    const CACHE_TTL = 30 // seconds

    // Try cache first
    const cached = await cacheGet<MLServiceHealth>(CACHE_KEY)
    if (cached) return cached

    try {
        const response = await fetch(`${ML_SERVICE_URL}/health`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })

        if (!response.ok) {
            throw new Error(`ML Service unhealthy: ${response.status}`)
        }

        const data: MLServiceHealth = await response.json()
        await cacheSet(CACHE_KEY, data, CACHE_TTL)
        return data
    } catch (error) {
        console.error("ML Service health check failed:", error)
        return {
            status: "unavailable",
            model_loaded: false,
            model_version: null,
            device: "unknown",
        }
    }
}

/**
 * Run inference on a mammogram image
 * 
 * IMPORTANT: Results are ADVISORY ONLY and must be reviewed by doctors
 * 
 * @param imageStorageRef - Storage reference for the image
 * @param caseId - Optional case ID for tracking
 */
export async function runInference(
    imageStorageRef: string,
    caseId?: string
): Promise<MLInferenceResult | null> {
    try {
        // Read image from secure storage
        const imageBuffer = await readFromStorage(imageStorageRef)

        // Create form data
        const formData = new FormData()
        formData.append("file", new Blob([new Uint8Array(imageBuffer)]), "image.dcm")
        if (caseId) {
            formData.append("case_id", caseId)
        }

        // Call ML service
        const response = await fetch(`${ML_SERVICE_URL}/infer`, {
            method: "POST",
            headers: {
                "X-API-Key": ML_SERVICE_API_KEY,
            },
            body: formData,
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || `Inference failed: ${response.status}`)
        }

        return await response.json()
    } catch (error) {
        console.error("ML inference failed:", error)
        return null
    }
}

/**
 * Run inference on multiple images (e.g., all images in a case)
 * Returns aggregated risk assessment
 */
export async function runBatchInference(
    imageStorageRefs: string[],
    caseId: string
): Promise<{
    inferences: MLInferenceResult[]
    aggregatedRiskTier: "LOW" | "MODERATE" | "ELEVATED" | "HIGH"
    highestBirads: number
    averageConfidence: number
} | null> {
    try {
        const inferences: MLInferenceResult[] = []

        // Run inference on each image
        for (const ref of imageStorageRefs) {
            const result = await runInference(ref, caseId)
            if (result) {
                inferences.push(result)
            }
        }

        if (inferences.length === 0) {
            return null
        }

        // Aggregate results (use highest risk for safety)
        const riskTierOrder: Record<string, number> = {
            LOW: 0,
            MODERATE: 1,
            ELEVATED: 2,
            HIGH: 3,
        }

        type RiskTier = "LOW" | "MODERATE" | "ELEVATED" | "HIGH"
        const aggregatedRiskTier = inferences.reduce<RiskTier>((highest, current) => {
            return riskTierOrder[current.risk_tier] > riskTierOrder[highest]
                ? current.risk_tier as RiskTier
                : highest
        }, "LOW")

        const highestBirads = Math.max(...inferences.map((i) => i.birads_prediction))
        const averageConfidence =
            inferences.reduce((sum, i) => sum + i.confidence, 0) / inferences.length

        return {
            inferences,
            aggregatedRiskTier,
            highestBirads,
            averageConfidence,
        }
    } catch (error) {
        console.error("Batch inference failed:", error)
        return null
    }
}

/**
 * Get model information.
 * Cached in Redis for 5 minutes — model info changes rarely.
 */
export async function getModelInfo(): Promise<Record<string, unknown> | null> {
    const CACHE_KEY = "ml:model-info"
    const CACHE_TTL = 300 // 5 minutes

    const cached = await cacheGet<Record<string, unknown>>(CACHE_KEY)
    if (cached) return cached

    try {
        const response = await fetch(`${ML_SERVICE_URL}/model-info`, {
            method: "GET",
            headers: {
                "X-API-Key": ML_SERVICE_API_KEY,
            },
        })

        if (!response.ok) {
            throw new Error(`Failed to get model info: ${response.status}`)
        }

        const data = await response.json()
        await cacheSet(CACHE_KEY, data, CACHE_TTL)
        return data
    } catch (error) {
        console.error("Failed to get model info:", error)
        return null
    }
}
