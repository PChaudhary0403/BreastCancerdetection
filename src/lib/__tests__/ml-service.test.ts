import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Mock fetch globally ────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// Mock the storage module (readFromStorage is used internally)
vi.mock("../storage", () => ({
    readFromStorage: vi.fn().mockResolvedValue(Buffer.from("fake image data")),
}))

// Set env vars before import
vi.stubEnv("ML_SERVICE_URL", "http://test-ml:8000")
vi.stubEnv("ML_SERVICE_API_KEY", "test-key-123")

// Dynamic import so env mocks take effect
const {
    checkMLServiceHealth,
    runInference,
    runBatchInference,
    getModelInfo,
} = await import("../ml-service")

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }
}

const sampleInference = {
    inference_id: "inf-1",
    case_id: null,
    timestamp: "2025-01-01T00:00:00Z",
    risk_tier: "LOW" as const,
    birads_prediction: 2,
    birads_probabilities: { birads_2: 0.9 },
    confidence: 0.92,
    malignancy_probability: 0.05,
    lesion_probability: 0.1,
    attention_map_reference: null,
    model_version: "v1",
    advisory_notice: "advisory",
}

beforeEach(() => {
    mockFetch.mockReset()
})

// ─── checkMLServiceHealth ───────────────────────────────────────────────────

describe("checkMLServiceHealth", () => {
    it("returns health data on success", async () => {
        mockFetch.mockResolvedValue(
            mockResponse({ status: "healthy", model_loaded: true, model_version: "v1", device: "cpu" })
        )
        const result = await checkMLServiceHealth()
        expect(result.status).toBe("healthy")
        expect(result.model_loaded).toBe(true)
    })

    it("returns unavailable on network error", async () => {
        mockFetch.mockRejectedValue(new Error("ECONNREFUSED"))
        const result = await checkMLServiceHealth()
        expect(result.status).toBe("unavailable")
        expect(result.model_loaded).toBe(false)
    })

    it("returns unavailable on non-ok response", async () => {
        mockFetch.mockResolvedValue(mockResponse({}, 500))
        const result = await checkMLServiceHealth()
        expect(result.status).toBe("unavailable")
    })
})

// ─── runInference ───────────────────────────────────────────────────────────

describe("runInference", () => {
    it("sends correct headers and returns result", async () => {
        mockFetch.mockResolvedValue(mockResponse(sampleInference))

        const result = await runInference("images/test.dcm", "case-1")

        expect(result).not.toBeNull()
        expect(result!.risk_tier).toBe("LOW")

        // Verify correct API key header was set
        const fetchCall = mockFetch.mock.calls[0]
        expect(fetchCall[1].headers["X-API-Key"]).toBe("test-key-123")
    })

    it("returns null on network error", async () => {
        mockFetch.mockRejectedValue(new Error("timeout"))
        const result = await runInference("images/test.dcm")
        expect(result).toBeNull()
    })

    it("returns null on 401 unauthorized", async () => {
        mockFetch.mockResolvedValue(mockResponse({ detail: "Invalid API key" }, 401))
        const result = await runInference("images/test.dcm")
        expect(result).toBeNull()
    })

    it("returns null on 503 model not loaded", async () => {
        mockFetch.mockResolvedValue(mockResponse({ detail: "Model not loaded" }, 503))
        const result = await runInference("images/test.dcm")
        expect(result).toBeNull()
    })
})

// ─── runBatchInference ──────────────────────────────────────────────────────

describe("runBatchInference", () => {
    it("aggregates risk tiers using highest-risk-wins", async () => {
        const lowResult = { ...sampleInference, risk_tier: "LOW" as const }
        const highResult = { ...sampleInference, inference_id: "inf-2", risk_tier: "HIGH" as const, birads_prediction: 5 }

        mockFetch
            .mockResolvedValueOnce(mockResponse(lowResult))
            .mockResolvedValueOnce(mockResponse(highResult))

        const result = await runBatchInference(["img1.dcm", "img2.dcm"], "case-1")

        expect(result).not.toBeNull()
        expect(result!.aggregatedRiskTier).toBe("HIGH")
        expect(result!.highestBirads).toBe(5)
        expect(result!.inferences).toHaveLength(2)
    })

    it("returns null when all inferences fail", async () => {
        mockFetch.mockRejectedValue(new Error("all down"))
        const result = await runBatchInference(["a.dcm", "b.dcm"], "case")
        expect(result).toBeNull()
    })

    it("computes correct average confidence", async () => {
        const r1 = { ...sampleInference, confidence: 0.8 }
        const r2 = { ...sampleInference, inference_id: "inf-2", confidence: 0.6 }

        mockFetch
            .mockResolvedValueOnce(mockResponse(r1))
            .mockResolvedValueOnce(mockResponse(r2))

        const result = await runBatchInference(["a.dcm", "b.dcm"], "case")
        expect(result!.averageConfidence).toBeCloseTo(0.7)
    })
})

// ─── getModelInfo ───────────────────────────────────────────────────────────

describe("getModelInfo", () => {
    it("returns model info on success", async () => {
        const info = { model_info: { backbone: "efficientnet_b3" } }
        mockFetch.mockResolvedValue(mockResponse(info))
        const result = await getModelInfo()
        expect(result).toEqual(info)
    })

    it("returns null on failure", async () => {
        mockFetch.mockResolvedValue(mockResponse({}, 500))
        const result = await getModelInfo()
        expect(result).toBeNull()
    })
})
