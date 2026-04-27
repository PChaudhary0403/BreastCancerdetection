/**
 * DICOM → JPEG conversion utility
 *
 * Flow:
 *   1. Parse DICOM with dicom-parser to extract pixel data + imaging tags
 *   2. Normalise 8-bit or 16-bit grayscale pixels to 0-255
 *   3. Encode as JPEG via sharp
 */

import sharp from "sharp"

// dicom-parser is a CommonJS module with no bundled types — use dynamic require
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DicomDataSet = any

export interface DicomConvertResult {
    jpeg: Buffer
    width: number
    height: number
    /** true if pixel data was successfully extracted, false if we used a placeholder */
    hasPixelData: boolean
}

/**
 * Convert a raw DICOM buffer to JPEG.
 * Throws if the buffer is not a valid DICOM file or pixel data is missing/corrupt.
 */
export async function dicomBufferToJpeg(
    dicomBuffer: Buffer,
    jpegQuality = 90
): Promise<DicomConvertResult> {

    // ── 1. Dynamically load dicom-parser (CJS module) ────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dicomParser = require("dicom-parser")

    // ── 2. Parse DICOM ───────────────────────────────────────────────────────
    let dataSet: DicomDataSet
    try {
        dataSet = dicomParser.parseDicom(new Uint8Array(dicomBuffer), {
            untilTag: "7fe00010", // stop parsing after pixel data for speed
        })
    } catch (err) {
        throw new Error(`Invalid or unreadable DICOM file: ${err}`)
    }

    // ── 3. Extract dimensions ────────────────────────────────────────────────
    const rows:   number = dataSet.uint16("x00280010") ?? 512
    const cols:   number = dataSet.uint16("x00280011") ?? 512
    const bitsAllocated: number = dataSet.uint16("x00280100") ?? 8
    const samplesPerPx:  number = dataSet.uint16("x00280002") ?? 1

    // ── 4. Extract pixel data element ────────────────────────────────────────
    const pixelDataEl = dataSet.elements["x7fe00010"]

    if (!pixelDataEl) {
        // No pixel data → return dark placeholder so the image slot isn't blank
        const placeholder = await sharp({
            create: {
                width: Math.max(cols, 8),
                height: Math.max(rows, 8),
                channels: 3,
                background: { r: 30, g: 30, b: 30 },
            },
        })
            .jpeg({ quality: jpegQuality })
            .toBuffer()

        return { jpeg: placeholder, width: cols, height: rows, hasPixelData: false }
    }

    // ── 5a. Encapsulated pixel data (JPEG/JPEG-LS already inside DICOM) ──────
    if (pixelDataEl.encapsulatedPixelData) {
        try {
            const fragments = dicomParser.readEncapsulatedPixelDataFromFragments(
                dataSet,
                pixelDataEl,
                0
            )
            if (fragments && fragments.length > 0) {
                const fragBuf = Buffer.from(fragments)
                // If it's already a JPEG just re-encode at our quality
                const jpeg = await sharp(fragBuf)
                    .rotate()
                    .jpeg({ quality: jpegQuality, progressive: true })
                    .toBuffer()
                return { jpeg, width: cols, height: rows, hasPixelData: true }
            }
        } catch {
            // Fall through to raw pixel extraction
        }
    }

    // ── 5b. Raw planar pixel data ────────────────────────────────────────────
    const rawOffset: number = pixelDataEl.dataOffset
    const rawLength: number = pixelDataEl.length

    if (!rawLength || rawLength === 0) {
        throw new Error("DICOM pixel data length is zero")
    }

    const expectedBytes = rows * cols * samplesPerPx * Math.ceil(bitsAllocated / 8)
    if (rawLength < expectedBytes) {
        throw new Error(
            `DICOM pixel data too short: expected ≥${expectedBytes} bytes, got ${rawLength}`
        )
    }

    // Slice the raw bytes out of the original buffer
    const rawBytes = new Uint8Array(
        dicomBuffer.buffer,
        dicomBuffer.byteOffset + rawOffset,
        Math.min(rawLength, dicomBuffer.byteLength - rawOffset)
    )

    let grayBuffer: Buffer

    if (bitsAllocated <= 8) {
        // ── 8-bit: copy directly ─────────────────────────────────────────────
        grayBuffer = Buffer.from(rawBytes.subarray(0, rows * cols * samplesPerPx))
    } else {
        // ── 16-bit → 8-bit with auto window/level ───────────────────────────
        const pixelCount = rows * cols * samplesPerPx
        const pixels16 = new Uint16Array(
            rawBytes.buffer,
            rawBytes.byteOffset,
            pixelCount
        )

        // Percentile windowing (1st–99th) to ignore sensor noise at extremes
        const sorted = new Float32Array(pixels16).sort()
        const lo = sorted[Math.floor(sorted.length * 0.01)] ?? 0
        const hi = sorted[Math.floor(sorted.length * 0.99)] ?? 65535
        const range = hi - lo || 1

        grayBuffer = Buffer.allocUnsafe(pixelCount)
        for (let i = 0; i < pixelCount; i++) {
            grayBuffer[i] = Math.round(
                Math.max(0, Math.min(255, ((pixels16[i] - lo) / range) * 255))
            )
        }
    }

    // ── 6. Encode to JPEG ────────────────────────────────────────────────────
    const channels: 1 | 3 = samplesPerPx === 3 ? 3 : 1
    const jpeg = await sharp(grayBuffer, {
        raw: { width: cols, height: rows, channels },
    })
        .rotate()
        .jpeg({ quality: jpegQuality, progressive: true })
        .toBuffer()

    return { jpeg, width: cols, height: rows, hasPixelData: true }
}
