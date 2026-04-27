import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    function proxy(req) {
        const token = req.nextauth.token
        const path = req.nextUrl.pathname

        // Role-based route protection
        if (path.startsWith("/dashboard/patient") && token?.role !== "PATIENT") {
            return NextResponse.redirect(new URL("/dashboard", req.url))
        }

        if (path.startsWith("/dashboard/doctor") && token?.role !== "DOCTOR") {
            return NextResponse.redirect(new URL("/dashboard", req.url))
        }

        if (path.startsWith("/dashboard/admin") && token?.role !== "ADMIN") {
            return NextResponse.redirect(new URL("/dashboard", req.url))
        }

        // Upload route - patients only
        if (path.startsWith("/upload") && token?.role !== "PATIENT") {
            return NextResponse.redirect(new URL("/dashboard", req.url))
        }

        // Review route - doctors only
        if (path.startsWith("/review") && token?.role !== "DOCTOR") {
            return NextResponse.redirect(new URL("/dashboard", req.url))
        }

        // Check account status
        if (token?.accountStatus !== "ACTIVE") {
            return NextResponse.redirect(new URL("/auth/suspended", req.url))
        }

        return NextResponse.next()
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
    }
)

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/cases/:path*",
        "/upload/:path*",
        "/review/:path*",
        "/admin/:path*",
    ],
}
