import { describe, it, expect, vi, beforeEach } from "vitest"
import crypto from "crypto"

// ── Set an encryption key before importing storage module ──────────────────
vi.stubEnv("STORAGE_ENCRYPTION_KEY", "test-encryption-key-32-bytes!!")

const {
    encryptBuffer,
    decryptBuffer,
} = await import("../storage")

// ─── Encryption with key set ────────────────────────────────────────────────

describe("encryptBuffer / decryptBuffer (with encryption key)", () => {
    it("encrypted output differs from plaintext input", () => {
        const original = Buffer.from("sensitive patient image data")
        const encrypted = encryptBuffer(original)
        expect(encrypted).not.toEqual(original)
    })

    it("round-trips back to original plaintext", () => {
        const original = Buffer.from("mammogram pixel data here")
        const encrypted = encryptBuffer(original)
        const decrypted = decryptBuffer(encrypted)
        expect(decrypted).toEqual(original)
    })

    it("encrypted buffer has IV (16) + AuthTag (16) + ciphertext structure", () => {
        const original = Buffer.from("test data")
        const encrypted = encryptBuffer(original)

        // IV = 16 bytes, AuthTag = 16 bytes, CipherText >= 1 byte
        expect(encrypted.length).toBeGreaterThanOrEqual(16 + 16 + 1)

        // Encrypted should be larger than original due to IV + AuthTag overhead
        expect(encrypted.length).toBeGreaterThan(original.length)
    })

    it("produces different ciphertexts for the same input (random IV)", () => {
        const original = Buffer.from("determinism check")
        const enc1 = encryptBuffer(original)
        const enc2 = encryptBuffer(original)

        // Different IVs → different ciphertexts
        expect(enc1).not.toEqual(enc2)

        // But both decrypt to the same plaintext
        expect(decryptBuffer(enc1)).toEqual(original)
        expect(decryptBuffer(enc2)).toEqual(original)
    })

    it("gracefully handles tampered ciphertext (no crash)", () => {
        const original = Buffer.from("important image data")
        const encrypted = encryptBuffer(original)

        // Tamper with a byte in the ciphertext portion (after IV + AuthTag)
        const tampered = Buffer.from(encrypted)
        tampered[32] = tampered[32]! ^ 0xff // flip bits

        // decryptBuffer should NOT throw — it falls back to returning raw data
        expect(() => decryptBuffer(tampered)).not.toThrow()
    })

    it("handles large buffers (1 MB)", () => {
        const large = crypto.randomBytes(1024 * 1024)
        const encrypted = encryptBuffer(large)
        const decrypted = decryptBuffer(encrypted)
        expect(decrypted).toEqual(large)
    })

    it("handles single-byte buffer", () => {
        const tiny = Buffer.from([0x42])
        const encrypted = encryptBuffer(tiny)
        const decrypted = decryptBuffer(encrypted)
        expect(decrypted).toEqual(tiny)
    })
})
