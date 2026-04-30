import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000"
const ML_API_KEY = process.env.ML_SERVICE_API_KEY || "dev-key"

interface RouteParams {
    params: Promise<{ filename: string }>
}

/**
 * GET /api/medsam/overlay/[filename]
 *
 * Proxies MedSAM overlay images from the ML service.
 * Returns the PNG image.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "DOCTOR") {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
        )
    }

    const { filename } = await params

    // Sanitize filename
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        return NextResponse.json({ error: "Invalid filename" }, { status: 400 })
    }

    try {
        const mlResponse = await fetch(
            `${ML_SERVICE_URL}/medsam-overlay/${filename}`,
            {
                headers: { "X-API-Key": ML_API_KEY },
            },
        )

        if (!mlResponse.ok) {
            return NextResponse.json(
                { error: "Overlay not found" },
                { status: mlResponse.status },
            )
        }

        const imageBuffer = await mlResponse.arrayBuffer()

        return new NextResponse(imageBuffer, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=3600",
            },
        })
    } catch (error) {
        console.error("MedSAM overlay proxy error:", error)
        return NextResponse.json(
            { error: "Failed to fetch overlay" },
            { status: 502 },
        )
    }
}
