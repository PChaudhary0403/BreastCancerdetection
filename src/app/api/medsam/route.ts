import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000"
const ML_API_KEY = process.env.ML_SERVICE_API_KEY || "dev-key"

/**
 * POST /api/medsam
 *
 * Proxies a MedSAM segmentation request from the doctor's review UI
 * to the ML service.  Expects a multipart form with:
 *   - file: the mammogram image (or an imageId to fetch internally)
 *   - x1, y1, x2, y2: bounding box coordinates
 *
 * Returns the JSON response from the ML service, with overlay URLs
 * rewritten to point at our own proxy endpoint.
 */
export async function POST(request: NextRequest) {
    // Auth guard: only verified doctors
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "DOCTOR") {
        return NextResponse.json(
            { error: "Unauthorized — doctor access required" },
            { status: 401 },
        )
    }

    try {
        // Forward the multipart form body as-is to the ML service
        const formData = await request.formData()

        const mlResponse = await fetch(`${ML_SERVICE_URL}/medsam-segment`, {
            method: "POST",
            headers: {
                "X-API-Key": ML_API_KEY,
            },
            body: formData,
        })

        if (!mlResponse.ok) {
            const errorText = await mlResponse.text()
            console.error("ML MedSAM error:", mlResponse.status, errorText)
            return NextResponse.json(
                { error: `ML service error: ${mlResponse.status}`, detail: errorText },
                { status: mlResponse.status },
            )
        }

        const data = await mlResponse.json()

        return NextResponse.json(data)
    } catch (error) {
        console.error("MedSAM proxy error:", error)
        return NextResponse.json(
            { error: "Failed to connect to ML service" },
            { status: 502 },
        )
    }
}
