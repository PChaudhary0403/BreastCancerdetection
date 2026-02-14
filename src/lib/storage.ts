import crypto from "crypto"
import fs from "fs/promises"
import path from "path"

// Ensure uploads directory exists
const UPLOAD_DIR = process.env.STORAGE_PATH || "./uploads"

export async function ensureUploadDir(): Promise<void> {
    try {
        await fs.mkdir(path.join(process.cwd(), UPLOAD_DIR), { recursive: true })
        await fs.mkdir(path.join(process.cwd(), UPLOAD_DIR, "images"), { recursive: true })
        await fs.mkdir(path.join(process.cwd(), UPLOAD_DIR, "attention-maps"), { recursive: true })
    } catch (error) {
        console.error("Failed to create upload directories:", error)
    }
}

/**
 * Generate a secure, random storage reference
 * This becomes the only way to access the file - no patient info in path
 */
export function generateStorageReference(extension: string = "dcm"): string {
    const timestamp = Date.now().toString(36)
    const randomBytes = crypto.randomBytes(16).toString("hex")
    return `${timestamp}-${randomBytes}.${extension}`
}

/**
 * Calculate SHA-256 hash of file for integrity verification
 */
export async function calculateFileHash(buffer: Buffer): Promise<string> {
    const hash = crypto.createHash("sha256")
    hash.update(buffer)
    return hash.digest("hex")
}

/**
 * Save file to secure storage
 * Returns the storage reference path
 */
export async function saveToStorage(
    buffer: Buffer,
    storageReference: string,
    subfolder: string = "images"
): Promise<string> {
    await ensureUploadDir()

    const filePath = path.join(process.cwd(), UPLOAD_DIR, subfolder, storageReference)
    await fs.writeFile(filePath, buffer)

    return `${subfolder}/${storageReference}`
}

/**
 * Read file from storage
 */
export async function readFromStorage(storagePath: string): Promise<Buffer> {
    // If it's a CBIS-DDSM path, it's likely in the project root (one level up from app)
    if (storagePath.startsWith("CBIS-DDSM")) {
        // Try root of project (one level up from current working directory)
        const rootPath = path.join(process.cwd(), "..", storagePath)
        try {
            return await fs.readFile(rootPath)
        } catch (e) {
            // If that fails, try relative to current directory (in case it's in the root)
            const sameDirRoot = path.join(process.cwd(), storagePath)
            try {
                return await fs.readFile(sameDirRoot)
            } catch (e2) {
                // Last resort: look for it in the likely absolute path location
                const absoluteRoot = path.join("c:", "Users", "panka", "Desktop", "manifest-ZkhPvrLo5216730872708713142", storagePath)
                return await fs.readFile(absoluteRoot)
            }
        }
    }

    const filePath = path.join(process.cwd(), UPLOAD_DIR, storagePath)
    return await fs.readFile(filePath)
}

/**
 * Delete file from storage
 */
export async function deleteFromStorage(storagePath: string): Promise<void> {
    const filePath = path.join(process.cwd(), UPLOAD_DIR, storagePath)
    await fs.unlink(filePath)
}

/**
 * Get file stats
 */
export async function getStorageStats(storagePath: string): Promise<{ size: number; created: Date }> {
    const filePath = path.join(process.cwd(), UPLOAD_DIR, storagePath)
    const stats = await fs.stat(filePath)
    return {
        size: stats.size,
        created: stats.birthtime,
    }
}
