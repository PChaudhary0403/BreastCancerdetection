/**
 * Cloudinary client configuration and helpers.
 *
 * All mammogram images are stored in Cloudinary so the app
 * is independent of local / Vercel filesystem limitations.
 */

import { v2 as cloudinary } from "cloudinary"

// ─── Configuration ──────────────────────────────────────────────────────────

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "diwthhhml",
    api_key: process.env.CLOUDINARY_API_KEY || "625464724691951",
    api_secret: process.env.CLOUDINARY_API_SECRET || "",
    secure: true,
})

// ─── Upload ─────────────────────────────────────────────────────────────────

/**
 * Upload a buffer to Cloudinary.
 * Returns the public URL and the public_id (used as storage reference).
 */
export async function cloudinaryUpload(
    buffer: Buffer,
    folder: string = "mammograms",
    resourceType: "image" | "raw" = "image"
): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `breastscreen/${folder}`,
                resource_type: resourceType,
                // Use raw for DICOM / non-standard formats
                format: resourceType === "raw" ? undefined : undefined,
            },
            (error, result) => {
                if (error) {
                    reject(new Error(`Cloudinary upload failed: ${error.message}`))
                } else if (result) {
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                    })
                } else {
                    reject(new Error("Cloudinary upload returned no result"))
                }
            }
        )
        uploadStream.end(buffer)
    })
}

// ─── Read ───────────────────────────────────────────────────────────────────

/**
 * Download a file from Cloudinary by its public_id.
 * Returns the raw buffer contents.
 */
export async function cloudinaryDownload(
    publicId: string,
    resourceType: "image" | "raw" = "image"
): Promise<Buffer> {
    const url = cloudinary.url(publicId, {
        resource_type: resourceType,
        secure: true,
    })

    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Cloudinary download failed: ${response.status} for ${publicId}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
}

// ─── Delete ─────────────────────────────────────────────────────────────────

/**
 * Delete a file from Cloudinary.
 */
export async function cloudinaryDelete(
    publicId: string,
    resourceType: "image" | "raw" = "image"
): Promise<void> {
    await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
    })
}

// ─── URL generation ─────────────────────────────────────────────────────────

/**
 * Get a signed URL for a Cloudinary resource.
 */
export function cloudinaryUrl(
    publicId: string,
    options: {
        width?: number
        height?: number
        crop?: string
        resourceType?: "image" | "raw"
    } = {}
): string {
    return cloudinary.url(publicId, {
        resource_type: options.resourceType || "image",
        secure: true,
        width: options.width,
        height: options.height,
        crop: options.crop || "limit",
        sign_url: true,
        type: "authenticated",
    })
}

export default cloudinary
