import { describe, it, expect } from "vitest"
import {
    generatePseudonymId,
    formatDate,
    formatDateTime,
    getRiskTierColor,
    getCaseStatusColor,
    sanitizeFileName,
} from "../utils"

// ─── generatePseudonymId ────────────────────────────────────────────────────

describe("generatePseudonymId", () => {
    it("starts with PSN- prefix", () => {
        const id = generatePseudonymId()
        expect(id).toMatch(/^PSN-/)
    })

    it("is uppercase", () => {
        const id = generatePseudonymId()
        expect(id).toBe(id.toUpperCase())
    })

    it("generates unique IDs", () => {
        const ids = new Set(Array.from({ length: 50 }, () => generatePseudonymId()))
        expect(ids.size).toBe(50)
    })
})

// ─── formatDate ─────────────────────────────────────────────────────────────

describe("formatDate", () => {
    it("formats a Date object to a readable string", () => {
        const date = new Date("2025-03-15T12:00:00Z")
        const result = formatDate(date)
        // Should contain year, month, and day
        expect(result).toContain("2025")
        expect(result).toContain("15")
    })

    it("accepts a string date", () => {
        const result = formatDate("2025-01-01")
        expect(result).toContain("2025")
    })
})

// ─── formatDateTime ─────────────────────────────────────────────────────────

describe("formatDateTime", () => {
    it("includes time components", () => {
        const dt = new Date("2025-06-20T14:30:00Z")
        const result = formatDateTime(dt)
        // Should contain the date
        expect(result).toContain("2025")
        expect(result).toContain("20")
    })

    it("accepts a string date", () => {
        const result = formatDateTime("2025-12-25T10:00:00Z")
        expect(result).toContain("2025")
    })
})

// ─── getRiskTierColor ───────────────────────────────────────────────────────

describe("getRiskTierColor", () => {
    it("returns green classes for LOW", () => {
        expect(getRiskTierColor("LOW")).toContain("green")
    })

    it("returns yellow classes for MODERATE", () => {
        expect(getRiskTierColor("MODERATE")).toContain("yellow")
    })

    it("returns orange classes for ELEVATED", () => {
        expect(getRiskTierColor("ELEVATED")).toContain("orange")
    })

    it("returns red classes for HIGH", () => {
        expect(getRiskTierColor("HIGH")).toContain("red")
    })

    it("returns gray classes for unknown tier", () => {
        expect(getRiskTierColor("UNKNOWN")).toContain("gray")
    })
})

// ─── getCaseStatusColor ─────────────────────────────────────────────────────

describe("getCaseStatusColor", () => {
    it("returns blue for PENDING_REVIEW", () => {
        expect(getCaseStatusColor("PENDING_REVIEW")).toContain("blue")
    })

    it("returns yellow for UNDER_REVIEW", () => {
        expect(getCaseStatusColor("UNDER_REVIEW")).toContain("yellow")
    })

    it("returns green for REVIEWED", () => {
        expect(getCaseStatusColor("REVIEWED")).toContain("green")
    })

    it("returns gray for CLOSED", () => {
        expect(getCaseStatusColor("CLOSED")).toContain("gray")
    })

    it("returns gray for unknown status", () => {
        expect(getCaseStatusColor("SOMETHING_ELSE")).toContain("gray")
    })
})

// ─── sanitizeFileName ───────────────────────────────────────────────────────

describe("sanitizeFileName", () => {
    it("replaces special characters with underscores", () => {
        expect(sanitizeFileName("hello world!@#.txt")).toBe("hello_world_.txt")
    })

    it("collapses consecutive underscores", () => {
        expect(sanitizeFileName("a!!!b")).toBe("a_b")
    })

    it("lowercases the result", () => {
        expect(sanitizeFileName("MyFile.TXT")).toBe("myfile.txt")
    })

    it("handles already clean names", () => {
        expect(sanitizeFileName("clean-file.dcm")).toBe("clean-file.dcm")
    })
})
