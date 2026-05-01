import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "diwthhhml",
    api_key: process.env.CLOUDINARY_API_KEY || "625464724691951",
    api_secret: process.env.CLOUDINARY_API_SECRET || "",
    secure: true,
})

/**
 * Generate a signed upload token so the browser can upload
 * directly to Cloudinary — bypassing Vercel's 4.5MB body limit entirely.
 */
export async function POST() {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "PATIENT") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const timestamp = Math.round(Date.now() / 1000)
        const folder = "breastscreen/mammograms"

        // Generate signature for direct client-side upload
        const signature = cloudinary.utils.api_sign_request(
            { timestamp, folder },
            process.env.CLOUDINARY_API_SECRET || ""
        )

        return NextResponse.json({
            signature,
            timestamp,
            folder,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME || "diwthhhml",
            apiKey: process.env.CLOUDINARY_API_KEY || "625464724691951",
        })
    } catch (error) {
        console.error("Cloudinary sign error:", error)
        return NextResponse.json({ error: "Failed to generate upload signature" }, { status: 500 })
    }
}
