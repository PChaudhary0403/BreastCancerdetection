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

const PRESET_NAME = "breastscreen_upload"

/**
 * Ensures an unsigned upload preset exists, then returns
 * the cloud name and preset name so the browser can upload
 * directly to Cloudinary without any signature.
 */
export async function POST() {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "PATIENT") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Try to get the preset; create it if it doesn't exist
        try {
            await cloudinary.api.upload_preset(PRESET_NAME)
        } catch {
            // Preset doesn't exist — create it
            await cloudinary.api.create_upload_preset({
                name: PRESET_NAME,
                unsigned: true,
                folder: "breastscreen/mammograms",
            })
            console.log("Created Cloudinary unsigned upload preset:", PRESET_NAME)
        }

        return NextResponse.json({
            cloudName: process.env.CLOUDINARY_CLOUD_NAME || "diwthhhml",
            uploadPreset: PRESET_NAME,
        })
    } catch (error) {
        console.error("Cloudinary sign error:", error)
        return NextResponse.json({ error: "Failed to prepare upload" }, { status: 500 })
    }
}
