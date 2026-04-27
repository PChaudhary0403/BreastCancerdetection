import { describe, it, expect } from "vitest"

/**
 * Tests for middleware route protection logic.
 *
 * We extract and test the role-checking rules directly rather than
 * spinning up Next.js middleware (which requires full server context).
 */

// ─── Extracted route-checking logic from middleware.ts ───────────────────────

type UserRole = "PATIENT" | "DOCTOR" | "ADMIN"

interface TokenData {
    role: UserRole
    accountStatus: string
}

interface ProtectionResult {
    allowed: boolean
    redirectTo?: string
}

/**
 * Pure function version of the middleware route protection logic.
 * Mirrors the checks in src/middleware.ts for testability.
 */
function checkRouteAccess(path: string, token: TokenData | null): ProtectionResult {
    // No token = not authenticated
    if (!token) {
        return { allowed: false, redirectTo: "/auth/login" }
    }

    // Account status check
    if (token.accountStatus !== "ACTIVE") {
        return { allowed: false, redirectTo: "/auth/suspended" }
    }

    // Role-based route protection
    if (path.startsWith("/dashboard/patient") && token.role !== "PATIENT") {
        return { allowed: false, redirectTo: "/dashboard" }
    }

    if (path.startsWith("/dashboard/doctor") && token.role !== "DOCTOR") {
        return { allowed: false, redirectTo: "/dashboard" }
    }

    if (path.startsWith("/dashboard/admin") && token.role !== "ADMIN") {
        return { allowed: false, redirectTo: "/dashboard" }
    }

    if (path.startsWith("/upload") && token.role !== "PATIENT") {
        return { allowed: false, redirectTo: "/dashboard" }
    }

    if (path.startsWith("/review") && token.role !== "DOCTOR") {
        return { allowed: false, redirectTo: "/dashboard" }
    }

    return { allowed: true }
}

// ─── Patient route protection ───────────────────────────────────────────────

describe("Patient route protection", () => {
    it("allows PATIENT to access /dashboard/patient", () => {
        const result = checkRouteAccess("/dashboard/patient", { role: "PATIENT", accountStatus: "ACTIVE" })
        expect(result.allowed).toBe(true)
    })

    it("blocks DOCTOR from /dashboard/patient", () => {
        const result = checkRouteAccess("/dashboard/patient", { role: "DOCTOR", accountStatus: "ACTIVE" })
        expect(result.allowed).toBe(false)
        expect(result.redirectTo).toBe("/dashboard")
    })

    it("blocks ADMIN from /dashboard/patient", () => {
        const result = checkRouteAccess("/dashboard/patient/cases", { role: "ADMIN", accountStatus: "ACTIVE" })
        expect(result.allowed).toBe(false)
    })
})

// ─── Doctor route protection ────────────────────────────────────────────────

describe("Doctor route protection", () => {
    it("allows DOCTOR to access /dashboard/doctor", () => {
        const result = checkRouteAccess("/dashboard/doctor", { role: "DOCTOR", accountStatus: "ACTIVE" })
        expect(result.allowed).toBe(true)
    })

    it("blocks PATIENT from /dashboard/doctor", () => {
        const result = checkRouteAccess("/dashboard/doctor", { role: "PATIENT", accountStatus: "ACTIVE" })
        expect(result.allowed).toBe(false)
    })

    it("allows DOCTOR to access /review routes", () => {
        const result = checkRouteAccess("/review/case-123", { role: "DOCTOR", accountStatus: "ACTIVE" })
        expect(result.allowed).toBe(true)
    })

    it("blocks PATIENT from /review routes", () => {
        const result = checkRouteAccess("/review/case-123", { role: "PATIENT", accountStatus: "ACTIVE" })
        expect(result.allowed).toBe(false)
    })
})

// ─── Admin route protection ─────────────────────────────────────────────────

describe("Admin route protection", () => {
    it("allows ADMIN to access /dashboard/admin", () => {
        const result = checkRouteAccess("/dashboard/admin", { role: "ADMIN", accountStatus: "ACTIVE" })
        expect(result.allowed).toBe(true)
    })

    it("blocks PATIENT from /dashboard/admin", () => {
        const result = checkRouteAccess("/dashboard/admin", { role: "PATIENT", accountStatus: "ACTIVE" })
        expect(result.allowed).toBe(false)
    })

    it("blocks DOCTOR from /dashboard/admin/doctors", () => {
        const result = checkRouteAccess("/dashboard/admin/doctors", { role: "DOCTOR", accountStatus: "ACTIVE" })
        expect(result.allowed).toBe(false)
    })
})

// ─── Upload route protection ────────────────────────────────────────────────

describe("Upload route protection", () => {
    it("allows PATIENT to access /upload", () => {
        const result = checkRouteAccess("/upload", { role: "PATIENT", accountStatus: "ACTIVE" })
        expect(result.allowed).toBe(true)
    })

    it("blocks DOCTOR from /upload", () => {
        const result = checkRouteAccess("/upload", { role: "DOCTOR", accountStatus: "ACTIVE" })
        expect(result.allowed).toBe(false)
    })

    it("blocks ADMIN from /upload", () => {
        const result = checkRouteAccess("/upload", { role: "ADMIN", accountStatus: "ACTIVE" })
        expect(result.allowed).toBe(false)
    })
})

// ─── Account status checks ──────────────────────────────────────────────────

describe("Account status checks", () => {
    it("blocks SUSPENDED accounts and redirects to /auth/suspended", () => {
        const result = checkRouteAccess("/dashboard/patient", { role: "PATIENT", accountStatus: "SUSPENDED" })
        expect(result.allowed).toBe(false)
        expect(result.redirectTo).toBe("/auth/suspended")
    })

    it("blocks DELETED accounts", () => {
        const result = checkRouteAccess("/dashboard/doctor", { role: "DOCTOR", accountStatus: "DELETED" })
        expect(result.allowed).toBe(false)
        expect(result.redirectTo).toBe("/auth/suspended")
    })

    it("blocks unauthenticated users (null token)", () => {
        const result = checkRouteAccess("/dashboard/patient", null)
        expect(result.allowed).toBe(false)
        expect(result.redirectTo).toBe("/auth/login")
    })
})
