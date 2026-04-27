import { describe, it, expect } from "vitest"
import {
    parseDicomHeader,
    validateMammogram,
    extractViewPosition,
    extractLaterality,
    detectFileType,
    sanitizeFilename,
    type DicomMetadata,
} from "../dicom"

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeDicomBuffer(): Buffer {
    // Minimal 132-byte buffer with DICM magic at offset 128
    const buf = Buffer.alloc(140, 0)
    buf.write("DICM", 128, "ascii")
    return buf
}

function makeMetadata(overrides: Partial<DicomMetadata> = {}): DicomMetadata {
    return {
        modality: null,
        manufacturer: null,
        modelName: null,
        viewPosition: null,
        laterality: null,
        rows: null,
        columns: null,
        bitsAllocated: null,
        bitsStored: null,
        photometricInterpretation: null,
        isValid: true,
        validationErrors: [],
        ...overrides,
    }
}

// ─── parseDicomHeader ───────────────────────────────────────────────────────

describe("parseDicomHeader", () => {
    it("returns isValid=true for a buffer with DICM magic", () => {
        const result = parseDicomHeader(makeDicomBuffer())
        expect(result.isValid).toBe(true)
        expect(result.validationErrors).toHaveLength(0)
    })

    it("returns isValid=false for a too-small buffer", () => {
        const result = parseDicomHeader(Buffer.alloc(50))
        expect(result.isValid).toBe(false)
        expect(result.validationErrors.length).toBeGreaterThan(0)
    })

    it("returns isValid=false for a buffer without DICM magic", () => {
        const buf = Buffer.alloc(140, 0)
        buf.write("NOPE", 128, "ascii")
        const result = parseDicomHeader(buf)
        expect(result.isValid).toBe(false)
    })
})

// ─── validateMammogram ──────────────────────────────────────────────────────

describe("validateMammogram", () => {
    it("returns valid for MG modality with sufficient resolution", () => {
        const meta = makeMetadata({ modality: "MG", rows: 4000, columns: 3000 })
        const result = validateMammogram(meta)
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
    })

    it("returns invalid for non-MG modality", () => {
        const meta = makeMetadata({ modality: "CT" })
        const result = validateMammogram(meta)
        expect(result.valid).toBe(false)
        expect(result.errors[0]).toContain("Invalid modality")
    })

    it("returns invalid for low-resolution rows", () => {
        const meta = makeMetadata({ modality: "MG", rows: 500, columns: 3000 })
        const result = validateMammogram(meta)
        expect(result.valid).toBe(false)
    })

    it("returns valid when modality is null (not present)", () => {
        const meta = makeMetadata({ modality: null })
        const result = validateMammogram(meta)
        expect(result.valid).toBe(true)
    })
})

// ─── extractViewPosition ───────────────────────────────────────────────────

describe("extractViewPosition", () => {
    it("returns metadata viewPosition when available", () => {
        const meta = makeMetadata({ viewPosition: "cc" })
        expect(extractViewPosition("file.dcm", meta)).toBe("CC")
    })

    it("falls back to filename containing CC", () => {
        const meta = makeMetadata()
        expect(extractViewPosition("patient_LEFT_CC.dcm", meta)).toBe("CC")
    })

    it("falls back to filename containing MLO", () => {
        const meta = makeMetadata()
        expect(extractViewPosition("scan_MLO_right.dcm", meta)).toBe("MLO")
    })

    it("returns null when nothing matches", () => {
        const meta = makeMetadata()
        expect(extractViewPosition("unknown_file.dcm", meta)).toBeNull()
    })
})

// ─── extractLaterality ──────────────────────────────────────────────────────

describe("extractLaterality", () => {
    it("returns LEFT for laterality 'L' from metadata", () => {
        const meta = makeMetadata({ laterality: "L" })
        expect(extractLaterality("file.dcm", meta)).toBe("LEFT")
    })

    it("returns RIGHT for laterality 'R' from metadata", () => {
        const meta = makeMetadata({ laterality: "R" })
        expect(extractLaterality("file.dcm", meta)).toBe("RIGHT")
    })

    it("falls back to filename containing LEFT", () => {
        const meta = makeMetadata()
        expect(extractLaterality("scan_LEFT_CC.dcm", meta)).toBe("LEFT")
    })

    it("falls back to filename containing RIGHT", () => {
        const meta = makeMetadata()
        expect(extractLaterality("scan_RIGHT_MLO.dcm", meta)).toBe("RIGHT")
    })

    it("returns null when not determinable", () => {
        const meta = makeMetadata()
        expect(extractLaterality("scan.dcm", meta)).toBeNull()
    })
})

// ─── detectFileType ─────────────────────────────────────────────────────────

describe("detectFileType", () => {
    it("detects DICOM by magic bytes", () => {
        const buf = makeDicomBuffer()
        const result = detectFileType(buf, "file.dcm")
        expect(result.type).toBe("dicom")
        expect(result.valid).toBe(true)
    })

    it("detects PNG by magic bytes", () => {
        const buf = Buffer.from("89504e470d0a1a0a" + "00".repeat(50), "hex")
        const result = detectFileType(buf, "file.png")
        expect(result.type).toBe("png")
        expect(result.valid).toBe(true)
    })

    it("detects JPEG by magic bytes", () => {
        const buf = Buffer.alloc(100)
        buf[0] = 0xff
        buf[1] = 0xd8
        buf[2] = 0xff
        const result = detectFileType(buf, "file.jpg")
        expect(result.type).toBe("jpeg")
        expect(result.valid).toBe(true)
    })

    it("falls back to extension for .dcm without magic", () => {
        const buf = Buffer.alloc(10)
        const result = detectFileType(buf, "image.dcm")
        expect(result.type).toBe("dicom")
        expect(result.valid).toBe(true)
    })

    it("returns unknown for unrecognized formats", () => {
        const buf = Buffer.alloc(10)
        const result = detectFileType(buf, "file.xyz")
        expect(result.type).toBe("unknown")
        expect(result.valid).toBe(false)
    })
})

// ─── sanitizeFilename ───────────────────────────────────────────────────────

describe("sanitizeFilename", () => {
    it("removes date patterns (potential PHI)", () => {
        const result = sanitizeFilename("scan_2025-03-15_report.dcm")
        expect(result).not.toContain("2025-03-15")
    })

    it("removes long number sequences (potential IDs)", () => {
        const result = sanitizeFilename("patient_12345678_scan.dcm")
        expect(result).not.toContain("12345678")
    })

    it("replaces special characters", () => {
        const result = sanitizeFilename("hello world!@#.dcm")
        expect(result).not.toContain("!")
        expect(result).not.toContain("@")
    })

    it("returns 'image' for inputs that sanitize to nothing", () => {
        const result = sanitizeFilename("!!!")
        expect(result).toBe("image")
    })

    it("collapses multiple underscores", () => {
        const result = sanitizeFilename("a___b___c.dcm")
        expect(result).not.toContain("___")
    })
})
