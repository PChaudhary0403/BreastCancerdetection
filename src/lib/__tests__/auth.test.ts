import { describe, it, expect } from "vitest"

/**
 * Tests for the authOptions configuration object.
 *
 * We import the config and inspect its structure rather than testing
 * the full NextAuth flow (which requires a running database).
 */

// Mock Prisma to prevent actual DB connection on import
const mockPrisma = {
    user: { findUnique: async () => null, update: async () => null },
    patient: { findUnique: async () => null, create: async () => null },
    doctor: { findUnique: async () => null },
    accessLog: { create: async () => null },
}

import { vi } from "vitest"
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }))

const { authOptions } = await import("../auth")

// ─── Session Configuration ──────────────────────────────────────────────────

describe("authOptions session config", () => {
    it("uses JWT strategy", () => {
        expect(authOptions.session?.strategy).toBe("jwt")
    })

    it("has 30-minute maxAge for medical data security", () => {
        expect(authOptions.session?.maxAge).toBe(30 * 60)
    })
})

// ─── Pages Configuration ────────────────────────────────────────────────────

describe("authOptions pages", () => {
    it("redirects sign-in to /auth/login", () => {
        expect(authOptions.pages?.signIn).toBe("/auth/login")
    })

    it("redirects errors to /auth/error", () => {
        expect(authOptions.pages?.error).toBe("/auth/error")
    })
})

// ─── Providers ──────────────────────────────────────────────────────────────

describe("authOptions providers", () => {
    it("includes at least 2 providers (Credentials + Google)", () => {
        expect(authOptions.providers.length).toBeGreaterThanOrEqual(2)
    })

    it("includes a credentials provider", () => {
        const hasCredentials = authOptions.providers.some(
            (p) => p.id === "credentials" || p.name === "credentials"
        )
        expect(hasCredentials).toBe(true)
    })

    it("includes a Google provider", () => {
        const hasGoogle = authOptions.providers.some(
            (p) => p.id === "google"
        )
        expect(hasGoogle).toBe(true)
    })
})

// ─── Callbacks ──────────────────────────────────────────────────────────────

describe("authOptions callbacks", () => {
    it("has a jwt callback", () => {
        expect(authOptions.callbacks?.jwt).toBeDefined()
        expect(typeof authOptions.callbacks?.jwt).toBe("function")
    })

    it("has a session callback", () => {
        expect(authOptions.callbacks?.session).toBeDefined()
        expect(typeof authOptions.callbacks?.session).toBe("function")
    })

    it("has a signIn callback", () => {
        expect(authOptions.callbacks?.signIn).toBeDefined()
        expect(typeof authOptions.callbacks?.signIn).toBe("function")
    })

    it("jwt callback populates role and accountStatus from user", async () => {
        const jwtCb = authOptions.callbacks!.jwt!
        const token = await jwtCb({
            token: { sub: "user-1" } as any,
            user: { id: "user-1", role: "DOCTOR", accountStatus: "ACTIVE" } as any,
            account: null,
            trigger: "signIn",
        } as any)

        expect(token.role).toBe("DOCTOR")
        expect(token.accountStatus).toBe("ACTIVE")
        expect(token.id).toBe("user-1")
    })
})

// ─── Events ─────────────────────────────────────────────────────────────────

describe("authOptions events", () => {
    it("has a signOut event handler", () => {
        expect(authOptions.events?.signOut).toBeDefined()
        expect(typeof authOptions.events?.signOut).toBe("function")
    })

    it("has a createUser event handler", () => {
        expect(authOptions.events?.createUser).toBeDefined()
        expect(typeof authOptions.events?.createUser).toBe("function")
    })
})
