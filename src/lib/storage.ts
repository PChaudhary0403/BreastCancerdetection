import crypto from "crypto"
import fs from "fs/promises"
import path from "path"
import { cloudinaryUpload, cloudinaryDownload, cloudinaryDelete } from "./cloudinary"

// ─── Configuration ──────────────────────────────────────────────────────────

const UPLOAD_DIR = process.env.STORAGE_PATH || "./uploads"
const CBIS_DDSM_PATH = process.env.CBIS_DDSM_PATH || ""
// Support both names for backward compatibility
const ENCRYPTION_KEY = process.env.STORAGE_ENCRYPTION_KEY || process.env.FILE_ENCRYPTION_KEY || ""

/**
 * Use Cloudinary when the API secret is configured (production),
 * fall back to local filesystem for local development.
 */
const USE_CLOUDINARY = !!process.env.CLOUDINARY_API_SECRET

const AES_ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

// ─── Encryption helpers ─────────────────────────────────────────────────────

function getEncryptionKey(): Buffer | null {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length === 0) {
        return null
    }
    // Derive a 32-byte key from the env var using SHA-256
    return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest()
}

/**
 * Encrypt a buffer with AES-256-GCM.
 * Returns: [IV (16 bytes)] + [AuthTag (16 bytes)] + [CipherText]
 */
export function encryptBuffer(buffer: Buffer): Buffer {
    const key = getEncryptionKey()
    if (!key) {
        // No encryption key configured — store plaintext (dev mode)
        return buffer
    }

    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv)

    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
    const authTag = cipher.getAuthTag()

    // Pack: IV + AuthTag + CipherText
    return Buffer.concat([iv, authTag, encrypted])
}

/**
 * Decrypt a buffer that was encrypted with encryptBuffer().
 * Falls back to returning raw data if decryption fails (legacy unencrypted file).
 */
export function decryptBuffer(buffer: Buffer): Buffer {
    const key = getEncryptionKey()
    if (!key) {
        // No encryption key configured — return as-is
        return buffer
    }

    // Minimum size: IV + AuthTag + at least 1 byte of data
    if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
        // Too small to be encrypted — likely a legacy unencrypted file
        return buffer
    }

    try {
        const iv = buffer.subarray(0, IV_LENGTH)
        const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
        const cipherText = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

        const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv)
        decipher.setAuthTag(authTag)

        return Buffer.concat([decipher.update(cipherText), decipher.final()])
    } catch {
        // Decryption failed — likely a legacy unencrypted file, return raw
        return buffer
    }
}

// ─── Local filesystem helpers ───────────────────────────────────────────────

function getStoragePath(subpath: string = ""): string {
    if (path.isAbsolute(UPLOAD_DIR)) {
        return path.join(UPLOAD_DIR, subpath)
    }
    return path.join(process.cwd(), UPLOAD_DIR, subpath)
}

export async function ensureUploadDir(): Promise<void> {
    if (USE_CLOUDINARY) return // No local dirs needed
    try {
        await fs.mkdir(getStoragePath(), { recursive: true })
        await fs.mkdir(getStoragePath("images"), { recursive: true })
        await fs.mkdir(getStoragePath("attention-maps"), { recursive: true })
    } catch (error) {
        console.error("Failed to create upload directories:", error)
    }
}

// ─── Storage reference generation ───────────────────────────────────────────

/**
 * Generate a secure, random storage reference.
 * This becomes the only way to access the file — no patient info in path.
 */
export function generateStorageReference(extension: string = "dcm"): string {
    const timestamp = Date.now().toString(36)
    const randomBytes = crypto.randomBytes(16).toString("hex")
    return `${timestamp}-${randomBytes}.${extension}`
}

// ─── File hashing ───────────────────────────────────────────────────────────

/**
 * Calculate SHA-256 hash of file for integrity verification.
 */
export async function calculateFileHash(buffer: Buffer): Promise<string> {
    const hash = crypto.createHash("sha256")
    hash.update(buffer)
    return hash.digest("hex")
}

// ─── Write / Read / Delete ──────────────────────────────────────────────────

/**
 * Determine if a file is a standard image format (uploadable as "image" to Cloudinary).
 */
function isImageFile(ref: string): boolean {
    const ext = ref.split(".").pop()?.toLowerCase() || ""
    return ["jpg", "jpeg", "png", "bmp", "webp", "tiff", "gif"].includes(ext)
}

/**
 * Save file to storage.
 *
 * - Production (Cloudinary): uploads the raw buffer to Cloudinary and
 *   returns a storage reference in the format `cloudinary:<publicId>`.
 * - Development (local): encrypts and saves to the local filesystem.
 */
export async function saveToStorage(
    buffer: Buffer,
    storageReference: string,
    subfolder: string = "images"
): Promise<string> {
    if (USE_CLOUDINARY) {
        const resourceType = isImageFile(storageReference) ? "image" : "raw"
        const { publicId } = await cloudinaryUpload(buffer, subfolder, resourceType)
        // Prefix with "cloudinary:" so readFromStorage knows where to look
        return `cloudinary:${resourceType}:${publicId}`
    }

    // Local filesystem fallback
    await ensureUploadDir()
    const encrypted = encryptBuffer(buffer)
    const filePath = getStoragePath(path.join(subfolder, storageReference))
    await fs.writeFile(filePath, encrypted)
    return `${subfolder}/${storageReference}`
}

/**
 * Read file from storage (decrypted automatically for local files).
 */
export async function readFromStorage(storagePath: string): Promise<Buffer> {
    // ── Cloudinary paths ──
    if (storagePath.startsWith("cloudinary:")) {
        const parts = storagePath.replace("cloudinary:", "").split(":")
        const resourceType = (parts[0] as "image" | "raw") || "image"
        const publicId = parts.slice(1).join(":")
        return cloudinaryDownload(publicId, resourceType)
    }

    // ── CBIS-DDSM dataset paths ──
    if (storagePath.startsWith("CBIS-DDSM")) {
        const projectRoot = process.cwd() + path.sep + ".."
        const searchPaths = [
            CBIS_DDSM_PATH ? path.join(CBIS_DDSM_PATH, storagePath.replace(/^CBIS-DDSM\/?/, "")) : "",
            path.join(projectRoot, storagePath),
            process.cwd() + path.sep + storagePath,
        ].filter(Boolean)

        for (const candidate of searchPaths) {
            try {
                return await fs.readFile(candidate)
            } catch {
                // Try next candidate
            }
        }
        throw new Error(`CBIS-DDSM file not found: ${storagePath}. Set CBIS_DDSM_PATH env var.`)
    }

    // ── Local filesystem ──
    const filePath = getStoragePath(storagePath)
    const raw = await fs.readFile(filePath)
    return decryptBuffer(raw)
}

/**
 * Delete file from storage.
 */
export async function deleteFromStorage(storagePath: string): Promise<void> {
    if (storagePath.startsWith("cloudinary:")) {
        const parts = storagePath.replace("cloudinary:", "").split(":")
        const resourceType = (parts[0] as "image" | "raw") || "image"
        const publicId = parts.slice(1).join(":")
        await cloudinaryDelete(publicId, resourceType)
        return
    }

    const filePath = getStoragePath(storagePath)
    await fs.unlink(filePath)
}

/**
 * Get file stats.
 * For Cloudinary files, returns a placeholder since stats aren't locally available.
 */
export async function getStorageStats(storagePath: string): Promise<{ size: number; created: Date }> {
    if (storagePath.startsWith("cloudinary:")) {
        // Cloudinary doesn't expose simple stat info via the URL approach;
        // return a reasonable placeholder.
        return { size: 0, created: new Date() }
    }

    const filePath = getStoragePath(storagePath)
    const stats = await fs.stat(filePath)
    return {
        size: stats.size,
        created: stats.birthtime,
    }
}

/**
 * Get a public URL for a stored image.
 * For Cloudinary images, returns the Cloudinary CDN URL.
 * For local images, returns the API route path.
 */
export function getImageUrl(storagePath: string): string {
    if (storagePath.startsWith("cloudinary:")) {
        const parts = storagePath.replace("cloudinary:", "").split(":")
        const resourceType = parts[0] || "image"
        const publicId = parts.slice(1).join(":")
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "diwthhhml"
        return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${publicId}`
    }
    // Local — serve through API
    return `/api/images/${encodeURIComponent(storagePath)}`
}
