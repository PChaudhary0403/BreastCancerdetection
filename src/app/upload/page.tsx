"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    Upload, X, FileImage, CheckCircle, AlertCircle,
    HeartPulse, ArrowLeft, Shield, HelpCircle, Loader2,
    ArrowRight, Sparkles, ImagePlus, FileCheck2
} from "lucide-react"

interface UploadedFile {
    file: File
    preview?: string
    status: "pending" | "uploading" | "success" | "error"
    error?: string
    progress?: number
}

const MAX_UPLOAD_SIZE = 3 * 1024 * 1024 // 3MB — safe headroom under Vercel's 4.5MB limit

/**
 * Compress an image file client-side using a canvas.
 * DICOM files are returned as-is (they need special handling server-side).
 * For JPEG/PNG, resize to a max dimension and re-encode as JPEG.
 */
async function compressImage(file: File): Promise<File> {
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    // Skip compression for DICOM files
    if (["dcm", "dicom"].includes(ext) || file.type === "application/dicom") {
        return file
    }
    // If file is already small enough, skip
    if (file.size <= MAX_UPLOAD_SIZE) {
        return file
    }

    return new Promise((resolve) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(url)
            const canvas = document.createElement("canvas")

            // Scale down aggressively to fit under 3MB
            const scaleFactor = Math.min(1, Math.sqrt(MAX_UPLOAD_SIZE / file.size) * 0.9)
            canvas.width = Math.round(img.width * scaleFactor)
            canvas.height = Math.round(img.height * scaleFactor)

            const ctx = canvas.getContext("2d")!
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const compressedName = file.name.replace(/\.\w+$/, ".jpg")
                        resolve(new File([blob], compressedName, { type: "image/jpeg" }))
                    } else {
                        resolve(file) // fallback to original
                    }
                },
                "image/jpeg",
                0.7
            )
        }
        img.onerror = () => {
            URL.revokeObjectURL(url)
            resolve(file) // fallback
        }
        img.src = url
    })
}

function UploadProgress({ progress }: { progress: number }) {
    return (
        <div className="progress-bar mt-1.5">
            <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
            />
        </div>
    )
}

export default function UploadPage() {
    const router = useRouter()
    const [files, setFiles] = useState<UploadedFile[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [uploadResult, setUploadResult] = useState<{
        success: boolean
        caseId?: string
        message?: string
        errors?: string[]
    } | null>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        const droppedFiles = Array.from(e.dataTransfer.files)
        addFiles(droppedFiles)
    }, [])

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files)
            addFiles(selectedFiles)
        }
    }, [])

    const addFiles = (newFiles: File[]) => {
        // Filter valid file types
        const validTypes = [
            "application/dicom",
            "image/png",
            "image/jpeg",
            "application/octet-stream", // DICOM files often have this type
        ]
        const validExtensions = [".dcm", ".dicom", ".png", ".jpg", ".jpeg"]

        const validFiles = newFiles.filter(file => {
            const ext = `.${file.name.split(".").pop()?.toLowerCase()}`
            return validTypes.includes(file.type) || validExtensions.includes(ext)
        })

        if (validFiles.length === 0) {
            return
        }

        // Limit to 4 files total
        const currentCount = files.length
        const allowedCount = Math.min(validFiles.length, 4 - currentCount)

        const filesToAdd = validFiles.slice(0, allowedCount).map(file => ({
            file,
            status: "pending" as const,
            progress: 0,
            preview: file.type.startsWith("image/")
                ? URL.createObjectURL(file)
                : undefined
        }))

        setFiles(prev => [...prev, ...filesToAdd])
    }

    const removeFile = (index: number) => {
        setFiles(prev => {
            const newFiles = [...prev]
            if (newFiles[index].preview) {
                URL.revokeObjectURL(newFiles[index].preview!)
            }
            newFiles.splice(index, 1)
            return newFiles
        })
    }

    const handleUpload = async () => {
        if (files.length === 0) return

        setIsUploading(true)
        setUploadResult(null)

        // Update all files to uploading status
        setFiles(prev => prev.map(f => ({ ...f, status: "uploading" as const, progress: 0 })))

        try {
            // Step 1: Get a signed upload token from our API (tiny JSON request)
            const signRes = await fetch("/api/cloudinary-sign", { method: "POST" })
            if (!signRes.ok) {
                throw new Error("Failed to get upload authorization")
            }
            const { signature, timestamp, folder, cloudName, apiKey } = await signRes.json()

            // Step 2: Upload each file DIRECTLY to Cloudinary (bypasses Vercel completely)
            const uploadedImages = []

            for (let i = 0; i < files.length; i++) {
                const f = files[i]
                try {
                    const cloudinaryForm = new FormData()
                    cloudinaryForm.append("file", f.file)
                    cloudinaryForm.append("signature", signature)
                    cloudinaryForm.append("timestamp", String(timestamp))
                    cloudinaryForm.append("folder", folder)
                    cloudinaryForm.append("api_key", apiKey)

                    const cloudRes = await fetch(
                        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                        { method: "POST", body: cloudinaryForm }
                    )

                    if (!cloudRes.ok) {
                        // Try as raw upload for DICOM files
                        const rawForm = new FormData()
                        rawForm.append("file", f.file)
                        rawForm.append("signature", signature)
                        rawForm.append("timestamp", String(timestamp))
                        rawForm.append("folder", folder)
                        rawForm.append("api_key", apiKey)

                        const rawRes = await fetch(
                            `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
                            { method: "POST", body: rawForm }
                        )

                        if (!rawRes.ok) throw new Error("Upload failed")
                        const rawResult = await rawRes.json()
                        uploadedImages.push({
                            publicId: rawResult.public_id,
                            url: rawResult.secure_url,
                            originalFilename: f.file.name,
                            format: rawResult.format || "dcm",
                            bytes: rawResult.bytes,
                        })
                    } else {
                        const cloudResult = await cloudRes.json()
                        uploadedImages.push({
                            publicId: cloudResult.public_id,
                            url: cloudResult.secure_url,
                            originalFilename: f.file.name,
                            format: cloudResult.format || "jpg",
                            bytes: cloudResult.bytes,
                        })
                    }

                    // Update individual file progress
                    setFiles(prev => prev.map((pf, idx) =>
                        idx === i ? { ...pf, progress: 100, status: "success" as const } : pf
                    ))
                } catch (fileErr) {
                    setFiles(prev => prev.map((pf, idx) =>
                        idx === i ? { ...pf, status: "error" as const, error: "Upload failed" } : pf
                    ))
                }
            }

            if (uploadedImages.length === 0) {
                throw new Error("No images could be uploaded")
            }

            // Step 3: Save metadata to our database (tiny JSON, no file data)
            const saveRes = await fetch("/api/cases/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ images: uploadedImages }),
            })

            const result = await saveRes.json()

            if (saveRes.ok) {
                setUploadResult({
                    success: true,
                    caseId: result.caseId,
                    message: result.message,
                })
                setFiles(prev => prev.map(f => ({ ...f, status: "success" as const, progress: 100 })))
            } else {
                setUploadResult({
                    success: false,
                    message: result.error || "Failed to save case",
                })
            }
        } catch (error) {
            setUploadResult({
                success: false,
                message: error instanceof Error ? error.message : "An unexpected error occurred. Please try again.",
            })
            setFiles(prev => prev.map(f =>
                f.status !== "success" ? { ...f, status: "error" as const } : f
            ))
        } finally {
            setIsUploading(false)
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    return (
        <div className="min-h-screen animated-gradient-bg">
            {/* Header */}
            <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-sm shadow-black/[0.02]">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard/patient"
                                className="p-2.5 rounded-xl hover:bg-white/60 text-slate-500 hover:text-slate-700 transition-all duration-200 hover:shadow-sm"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <HeartPulse className="w-5 h-5 text-white" />
                                </div>
                                <span className="font-semibold text-slate-800">Upload Mammogram</span>
                            </div>
                        </div>
                        {/* Step indicator */}
                        <div className="hidden sm:flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${files.length > 0 ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                                <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold">1</span>
                                Select
                            </div>
                            <div className="w-6 h-px bg-slate-300" />
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${uploadResult?.success ? "bg-green-100 text-green-700" : isUploading ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
                                }`}>
                                <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold">2</span>
                                Upload
                            </div>
                            <div className="w-6 h-px bg-slate-300" />
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${uploadResult?.success ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                                }`}>
                                <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold">3</span>
                                Done
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-700 ${mounted ? "animate-fade-in-up" : "opacity-0"}`}>
                {/* Success State */}
                {uploadResult?.success && (
                    <div className="card-glass p-10 text-center mb-8 animate-scale-in shadow-xl">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
                            <CheckCircle className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-3">
                            Images Submitted Successfully! 🎉
                        </h2>
                        <p className="text-slate-600 mb-2 max-w-md mx-auto leading-relaxed">
                            Your mammogram images have been securely received. A qualified specialist
                            will review them and you will be notified when results are available.
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg mb-8">
                            <span className="text-sm text-slate-500">Case Reference:</span>
                            <span className="font-mono font-bold text-slate-900">{uploadResult.caseId?.slice(-8).toUpperCase()}</span>
                        </div>
                        <div className="flex gap-4 justify-center">
                            <Link
                                href="/dashboard/patient"
                                className="btn btn-primary btn-shimmer shadow-lg shadow-blue-500/20"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Return to Dashboard
                            </Link>
                            <Link
                                href={`/dashboard/patient/cases/${uploadResult.caseId}`}
                                className="btn btn-secondary"
                            >
                                View Case Status
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                )}

                {/* Upload Form */}
                {!uploadResult?.success && (
                    <>
                        {/* Instructions */}
                        <div className="card-glass p-6 mb-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <HelpCircle className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 mb-2">Upload Instructions</h3>
                                    <ul className="text-sm text-slate-600 space-y-1.5">
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                            Upload up to 4 mammogram images per submission
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                            Accepted formats: DICOM (.dcm), PNG, JPEG
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                            Large images are automatically compressed before upload
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                            Include both CC and MLO views if available
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                            Images for both left and right breasts are recommended
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Drop Zone */}
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`card-glass p-10 border-2 border-dashed transition-all duration-300 animate-fade-in-up ${isDragging
                                ? "dropzone-active border-blue-400 bg-blue-50/50 scale-[1.01]"
                                : "border-slate-300/60 hover:border-blue-300 hover:bg-white/60"
                                } ${files.length >= 4 ? "opacity-50 pointer-events-none" : ""}`}
                            style={{ animationDelay: "200ms" }}
                        >
                            <div className="text-center">
                                <div className={`w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center transition-all duration-300 ${isDragging
                                        ? "bg-blue-100 scale-110"
                                        : "bg-slate-100"
                                    }`}>
                                    <ImagePlus className={`w-10 h-10 transition-colors duration-200 ${isDragging ? "text-blue-500" : "text-slate-400"
                                        }`} />
                                </div>
                                <p className="text-lg font-semibold text-slate-900 mb-2">
                                    {isDragging ? "Drop files here" : "Drag and drop your mammogram images"}
                                </p>
                                <p className="text-sm text-slate-500 mb-5">
                                    or click to select files • DICOM, PNG, JPEG accepted
                                </p>
                                <label className="btn btn-secondary cursor-pointer inline-flex hover:shadow-md transition-all duration-200">
                                    <FileImage className="w-4 h-4" />
                                    Select Files
                                    <input
                                        type="file"
                                        multiple
                                        accept=".dcm,.dicom,.png,.jpg,.jpeg,image/png,image/jpeg,application/dicom"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        disabled={files.length >= 4}
                                    />
                                </label>
                                <p className="text-xs text-slate-400 mt-3">
                                    {files.length}/4 files selected
                                </p>
                            </div>
                        </div>

                        {/* Selected Files */}
                        {files.length > 0 && (
                            <div className="card-glass p-6 mt-6 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
                                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <FileCheck2 className="w-5 h-5 text-blue-500" />
                                    Selected Files
                                    <span className="text-sm font-normal text-slate-400">({files.length}/4)</span>
                                </h3>
                                <div className="space-y-3">
                                    {files.map((file, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${file.status === "success"
                                                    ? "bg-green-50/80 border border-green-200"
                                                    : file.status === "error"
                                                        ? "bg-red-50/80 border border-red-200"
                                                        : file.status === "uploading"
                                                            ? "bg-blue-50/50 border border-blue-200"
                                                            : "bg-white/50 hover:bg-white/80 border border-transparent"
                                                }`}
                                        >
                                            {file.preview ? (
                                                <img
                                                    src={file.preview}
                                                    alt=""
                                                    className="w-14 h-14 rounded-xl object-cover shadow-sm"
                                                />
                                            ) : (
                                                <div className="w-14 h-14 rounded-xl bg-slate-200 flex items-center justify-center">
                                                    <FileImage className="w-6 h-6 text-slate-400" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-900 truncate">
                                                    {file.file.name}
                                                </p>
                                                <p className="text-sm text-slate-500">
                                                    {formatFileSize(file.file.size)}
                                                </p>
                                                {file.status === "uploading" && (
                                                    <UploadProgress progress={Math.min(file.progress || 0, 100)} />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {file.status === "uploading" && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-blue-600 font-medium">{Math.round(Math.min(file.progress || 0, 100))}%</span>
                                                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                                                    </div>
                                                )}
                                                {file.status === "success" && (
                                                    <div className="flex items-center gap-1.5 animate-scale-in">
                                                        <span className="text-xs text-green-600 font-medium">Done</span>
                                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                                    </div>
                                                )}
                                                {file.status === "error" && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs text-red-600 font-medium">Failed</span>
                                                        <AlertCircle className="w-5 h-5 text-red-500" />
                                                    </div>
                                                )}
                                                {file.status === "pending" && (
                                                    <button
                                                        onClick={() => removeFile(index)}
                                                        className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all duration-200"
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Error Display */}
                        {uploadResult && !uploadResult.success && (
                            <div className="card-glass p-6 mt-6 border border-red-200 bg-red-50/50 animate-fade-in-down">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                                        <AlertCircle className="w-5 h-5 text-red-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-red-800">{uploadResult.message}</h4>
                                        {uploadResult.errors && (
                                            <ul className="text-sm text-red-700 mt-2 space-y-1">
                                                {uploadResult.errors.map((err, i) => (
                                                    <li key={i} className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                                        {err}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        {files.length > 0 && (
                            <div className="mt-6 animate-fade-in-up" style={{ animationDelay: "400ms" }}>
                                <button
                                    onClick={handleUpload}
                                    disabled={isUploading || files.every(f => f.status !== "pending")}
                                    className="btn btn-primary btn-shimmer w-full py-3.5 text-base shadow-xl shadow-blue-500/20 hover:shadow-blue-500/30"
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Uploading securely...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-5 h-5" />
                                            <span>Submit for Expert Review</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Privacy Notice */}
                        <div className="mt-8 card-glass p-5 border-l-4 border-green-400 animate-fade-in-up" style={{ animationDelay: "500ms" }}>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                                    <Shield className="w-4 h-4 text-green-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-green-800 text-sm">Your Privacy is Protected</h4>
                                    <p className="text-sm text-green-700 mt-1 leading-relaxed">
                                        All personal information is removed from your images before storage.
                                        Your data is encrypted and only accessible to verified medical professionals
                                        for the purpose of your screening review.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Disclaimer */}
                        <div className="disclaimer-banner mt-6 animate-fade-in-up" style={{ animationDelay: "600ms" }}>
                            <p className="text-sm">
                                <strong>Important:</strong> This is a screening support tool. All images are
                                reviewed by certified medical professionals. Results are typically available
                                within 24-72 hours. For urgent medical concerns, please contact your healthcare
                                provider directly.
                            </p>
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}
