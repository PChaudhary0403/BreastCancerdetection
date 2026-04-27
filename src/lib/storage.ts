import crypto from "crypto"
import fs from "fs/promises"
import path from "path"

// ─── Configuration ──────────────────────────────────────────────────────────

const UPLOAD_DIR = process.env.STORAGE_PATH || "./uploads"
const CBIS_DDSM_PATH = process.env.CBIS_DDSM_PATH || ""
// Support both names for backward compatibility
const ENCRYPTION_KEY = process.env.STORAGE_ENCRYPTION_KEY || process.env.FILE_ENCRYPTION_KEY || ""

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

// ─── Directory management ───────────────────────────────────────────────────

export async function ensureUploadDir(): Promise<void> {
    try {
        await fs.mkdir(path.join(process.cwd(), UPLOAD_DIR), { recursive: true })
        await fs.mkdir(path.join(process.cwd(), UPLOAD_DIR, "images"), { recursive: true })
        await fs.mkdir(path.join(process.cwd(), UPLOAD_DIR, "attention-maps"), { recursive: true })
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
 * Save file to secure storage (encrypted at rest).
 * Returns the storage reference path.
 */
export async function saveToStorage(
    buffer: Buffer,
    storageReference: string,
    subfolder: string = "images"
): Promise<string> {
    await ensureUploadDir()

    const encrypted = encryptBuffer(buffer)
    const filePath = path.join(process.cwd(), UPLOAD_DIR, subfolder, storageReference)
    await fs.writeFile(filePath, encrypted)

    return `${subfolder}/${storageReference}`
}

/**
 * Read file from storage (decrypted automatically).
 */
export async function readFromStorage(storagePath: string): Promise<Buffer> {
    // CBIS-DDSM dataset paths — resolve via env or relative to project root
    if (storagePath.startsWith("CBIS-DDSM")) {
        const searchPaths = [
            // 1. Explicit env var
            CBIS_DDSM_PATH ? path.join(CBIS_DDSM_PATH, storagePath.replace(/^CBIS-DDSM\/?/, "")) : "",
            // 2. Relative to project root (one level up from cwd)
            path.join(process.cwd(), "..", storagePath),
            // 3. Relative to cwd
            path.join(process.cwd(), storagePath),
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

    const filePath = path.join(process.cwd(), UPLOAD_DIR, storagePath)
    const raw = await fs.readFile(filePath)
    return decryptBuffer(raw)
}

/**
 * Delete file from storage.
 */
export async function deleteFromStorage(storagePath: string): Promise<void> {
    const filePath = path.join(process.cwd(), UPLOAD_DIR, storagePath)
    await fs.unlink(filePath)
}

/**
 * Get file stats.
 */
export async function getStorageStats(storagePath: string): Promise<{ size: number; created: Date }> {
    const filePath = path.join(process.cwd(), UPLOAD_DIR, storagePath)
    const stats = await fs.stat(filePath)
    return {
        size: stats.size,
        created: stats.birthtime,
    }
}
