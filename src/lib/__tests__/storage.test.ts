import { describe, it, expect } from "vitest"
import crypto from "crypto"
import {
    generateStorageReference,
    calculateFileHash,
    encryptBuffer,
    decryptBuffer,
} from "../storage"

// ─── generateStorageReference ───────────────────────────────────────────────

describe("generateStorageReference", () => {
    it("returns a string with the default .dcm extension", () => {
        const ref = generateStorageReference()
        expect(ref).toMatch(/^[a-z0-9]+-[a-f0-9]{32}\.dcm$/)
    })

    it("uses a custom extension when provided", () => {
        const ref = generateStorageReference("png")
        expect(ref.endsWith(".png")).toBe(true)
    })

    it("generates unique references on successive calls", () => {
        const refs = new Set(Array.from({ length: 20 }, () => generateStorageReference()))
        expect(refs.size).toBe(20)
    })
})

// ─── calculateFileHash ──────────────────────────────────────────────────────

describe("calculateFileHash", () => {
    it("returns the correct SHA-256 hex digest", async () => {
        const data = Buffer.from("hello world")
        const hash = await calculateFileHash(data)
        const expected = crypto.createHash("sha256").update("hello world").digest("hex")
        expect(hash).toBe(expected)
    })

    it("is deterministic — same input produces same hash", async () => {
        const data = Buffer.from("determinism test")
        const h1 = await calculateFileHash(data)
        const h2 = await calculateFileHash(data)
        expect(h1).toBe(h2)
    })

    it("produces different hashes for different inputs", async () => {
        const h1 = await calculateFileHash(Buffer.from("input-a"))
        const h2 = await calculateFileHash(Buffer.from("input-b"))
        expect(h1).not.toBe(h2)
    })
})

// ─── Encryption round-trip ──────────────────────────────────────────────────

describe("encryptBuffer / decryptBuffer", () => {
    it("round-trips correctly when no encryption key is set", () => {
        // With no FILE_ENCRYPTION_KEY env var, functions act as pass-through
        const original = Buffer.from("patient image data")
        const encrypted = encryptBuffer(original)
        const decrypted = decryptBuffer(encrypted)
        expect(decrypted).toEqual(original)
    })

    it("handles empty buffers", () => {
        const empty = Buffer.alloc(0)
        const result = decryptBuffer(encryptBuffer(empty))
        expect(result).toEqual(empty)
    })

    it("handles large buffers", () => {
        const large = crypto.randomBytes(1024 * 1024) // 1 MB
        const result = decryptBuffer(encryptBuffer(large))
        expect(result).toEqual(large)
    })
})
