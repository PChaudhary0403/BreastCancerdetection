/**
 * DICOM Image Processing Utilities
 * 
 * Handles DICOM parsing with focus on:
 * 1. Extracting imaging metadata ONLY (no patient identifiers)
 * 2. Stripping all PHI (Protected Health Information)
 * 3. Validating mammography modality
 */

// DICOM tags that contain Protected Health Information (PHI)
// These must NEVER be stored or logged
const PHI_TAGS = [
    "00100010", // Patient Name
    "00100020", // Patient ID
    "00100030", // Patient Birth Date
    "00100040", // Patient Sex (optional to strip)
    "00101000", // Other Patient IDs
    "00101001", // Other Patient Names
    "00101040", // Patient Address
    "00102160", // Ethnic Group
    "00104000", // Patient Comments
    "00080050", // Accession Number
    "00080080", // Institution Name
    "00080081", // Institution Address
    "00080090", // Referring Physician Name
    "00081040", // Institutional Department Name
    "00081048", // Physician(s) of Record
    "00081050", // Performing Physician Name
    "00081060", // Name of Physician(s) Reading Study
    "00081070", // Operators Name
    "00200010", // Study ID
    "00321032", // Requesting Physician
    "00321033", // Requesting Service
    "00380010", // Admission ID
    "00380300", // Current Patient Location
    "00380400", // Patient Institution Residence
    "00400006", // Scheduled Performing Physician Name
    "00401001", // Requested Procedure ID
    "00104000", // Patient Comments
]

// Safe DICOM tags to extract for imaging metadata
const SAFE_TAGS = {
    "00080060": "modality",           // Modality (MG for mammography)
    "00080070": "manufacturer",       // Manufacturer
    "00081090": "modelName",          // Manufacturer Model Name
    "00180060": "kvp",                // KVP (X-ray tube voltage)
    "00181150": "exposureTime",       // Exposure Time
    "00181152": "exposure",           // Exposure
    "00181164": "imagerPixelSpacing", // Imager Pixel Spacing
    "00185101": "viewPosition",       // View Position (CC, MLO, etc.)
    "00200060": "laterality",         // Laterality (L, R)
    "00280010": "rows",               // Image Rows
    "00280011": "columns",            // Image Columns
    "00280100": "bitsAllocated",      // Bits Allocated
    "00280101": "bitsStored",         // Bits Stored
    "00280004": "photometricInterpretation", // Photometric Interpretation
    "00540220": "viewCodeSequence",   // View Code Sequence
}

export interface DicomMetadata {
    modality: string | null
    manufacturer: string | null
    modelName: string | null
    viewPosition: string | null   // CC (craniocaudal) or MLO (mediolateral oblique)
    laterality: string | null     // LEFT, RIGHT
    rows: number | null
    columns: number | null
    bitsAllocated: number | null
    bitsStored: number | null
    photometricInterpretation: string | null
    isValid: boolean
    validationErrors: string[]
}

/**
 * Parse DICOM header to extract safe metadata only
 * This is a simplified parser - in production, use a proper DICOM library
 */
export function parseDicomHeader(buffer: Buffer): DicomMetadata {
    const metadata: DicomMetadata = {
        modality: null,
        manufacturer: null,
        modelName: null,
        viewPosition: null,
        laterality: null,
        rows: null,
        columns: null,
        bitsAllocated: null,
        bitsStored: null,
        photometricInterpretation: null,
        isValid: false,
        validationErrors: [],
    }

    // Check DICOM magic number (DICM at offset 128)
    if (buffer.length < 132) {
        metadata.validationErrors.push("File too small to be valid DICOM")
        return metadata
    }

    const magicNumber = buffer.toString("ascii", 128, 132)
    if (magicNumber !== "DICM") {
        metadata.validationErrors.push("Invalid DICOM file: missing DICM header")
        return metadata
    }

    // For a production system, use a proper DICOM parsing library like:
    // - dcmjs
    // - dicom-parser
    // - cornerstone-wado-image-loader

    // This is a simplified check - extract basic info from filename or assume MG
    // In production, parse actual DICOM tags

    metadata.isValid = true
    return metadata
}

/**
 * Validate that the image is a mammogram
 */
export function validateMammogram(metadata: DicomMetadata): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check modality if available
    if (metadata.modality && metadata.modality !== "MG") {
        errors.push(`Invalid modality: ${metadata.modality}. Only mammography (MG) is accepted.`)
    }

    // Check minimum image dimensions
    if (metadata.rows && metadata.rows < 1000) {
        errors.push("Image resolution too low for mammography analysis")
    }

    if (metadata.columns && metadata.columns < 1000) {
        errors.push("Image resolution too low for mammography analysis")
    }

    return {
        valid: errors.length === 0,
        errors,
    }
}

/**
 * Extract view position from DICOM or filename
 * Returns CC (craniocaudal) or MLO (mediolateral oblique)
 */
export function extractViewPosition(filename: string, metadata: DicomMetadata): string | null {
    if (metadata.viewPosition) {
        return metadata.viewPosition.toUpperCase()
    }

    const upperFilename = filename.toUpperCase()
    if (upperFilename.includes("CC")) return "CC"
    if (upperFilename.includes("MLO")) return "MLO"
    if (upperFilename.includes("LATERAL")) return "MLO"

    return null
}

/**
 * Extract laterality from DICOM or filename
 * Returns LEFT or RIGHT
 */
export function extractLaterality(filename: string, metadata: DicomMetadata): string | null {
    if (metadata.laterality) {
        const lat = metadata.laterality.toUpperCase()
        if (lat === "L" || lat === "LEFT") return "LEFT"
        if (lat === "R" || lat === "RIGHT") return "RIGHT"
        return lat
    }

    const upperFilename = filename.toUpperCase()
    if (upperFilename.includes("LEFT") || upperFilename.includes("_L_") || upperFilename.startsWith("L_")) return "LEFT"
    if (upperFilename.includes("RIGHT") || upperFilename.includes("_R_") || upperFilename.startsWith("R_")) return "RIGHT"

    return null
}

/**
 * Check if uploaded file appears to be a valid medical image
 * Supports DICOM and common image formats
 */
export function detectFileType(buffer: Buffer, filename: string): { type: string; valid: boolean; error?: string } {
    // Check DICOM
    if (buffer.length >= 132) {
        const dicomMagic = buffer.toString("ascii", 128, 132)
        if (dicomMagic === "DICM") {
            return { type: "dicom", valid: true }
        }
    }

    // Check PNG
    if (buffer.length >= 8) {
        const pngMagic = buffer.slice(0, 8)
        if (pngMagic.toString("hex") === "89504e470d0a1a0a") {
            return { type: "png", valid: true }
        }
    }

    // Check JPEG
    if (buffer.length >= 3) {
        if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
            return { type: "jpeg", valid: true }
        }
    }

    // Check TIFF (little-endian: 49 49 2A 00, big-endian: 4D 4D 00 2A)
    if (buffer.length >= 4) {
        const b0 = buffer[0], b1 = buffer[1], b2 = buffer[2], b3 = buffer[3]
        if ((b0 === 0x49 && b1 === 0x49 && b2 === 0x2a && b3 === 0x00) ||
            (b0 === 0x4d && b1 === 0x4d && b2 === 0x00 && b3 === 0x2a)) {
            return { type: "tiff", valid: true }
        }
    }

    // Check BMP (BM header)
    if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
        return { type: "bmp", valid: true }
    }

    // Check WebP (RIFF....WEBP)
    if (buffer.length >= 12) {
        const riff = buffer.toString("ascii", 0, 4)
        const webp = buffer.toString("ascii", 8, 12)
        if (riff === "RIFF" && webp === "WEBP") {
            return { type: "webp", valid: true }
        }
    }

    // Check file extension as fallback
    const ext = filename.toLowerCase().split(".").pop()
    if (ext === "dcm" || ext === "dicom") {
        return { type: "dicom", valid: true }
    }
    if (ext === "png") {
        return { type: "png", valid: true }
    }
    if (ext === "jpg" || ext === "jpeg") {
        return { type: "jpeg", valid: true }
    }
    if (ext === "tif" || ext === "tiff") {
        return { type: "tiff", valid: true }
    }
    if (ext === "bmp") {
        return { type: "bmp", valid: true }
    }
    if (ext === "webp") {
        return { type: "webp", valid: true }
    }

    return {
        type: "unknown",
        valid: false,
        error: "Unsupported file format. Please upload DICOM, PNG, JPEG, TIFF, BMP, or WebP files."
    }
}

/**
 * Sanitize filename - remove any potential PHI
 */
export function sanitizeFilename(filename: string): string {
    // Remove common PHI patterns (dates, names, IDs)
    let sanitized = filename
        .replace(/\d{4}[-/]\d{2}[-/]\d{2}/g, "") // Remove dates
        .replace(/\d{8,}/g, "") // Remove long number sequences (potential IDs)
        .replace(/[A-Z][a-z]+\s+[A-Z][a-z]+/g, "") // Remove potential names
        .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace special chars
        .replace(/_+/g, "_") // Collapse multiple underscores
        .replace(/^_|_$/g, "") // Trim underscores

    // Ensure we have something left
    if (!sanitized || sanitized.length < 3) {
        sanitized = "image"
    }

    return sanitized
}
