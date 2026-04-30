"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
    Crosshair, Loader2, RotateCcw, Check, Download, Maximize2,
    Move, Box, Sparkles, AlertCircle, ChevronDown, ChevronUp
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────

interface BBox {
    x1: number
    y1: number
    x2: number
    y2: number
}

interface MedSAMResult {
    inference_id: string
    tumor_detected: boolean
    tumor_area_fraction: number
    bbox_used: number[]
    overlay_reference: string | null
    mask_reference: string | null
}

interface MedSAMAnnotatorProps {
    /** Image URL to annotate (the mammogram shown in the review) */
    imageUrl: string
    /** Image ID for passing to the API */
    imageId: string
    /** Callback when segmentation is approved by the doctor */
    onSegmentationApproved?: (result: MedSAMResult) => void
    /** Lateral position label */
    laterality?: string | null
    /** View position label */
    viewPosition?: string | null
}

// ─── Component ──────────────────────────────────────────────────────

export default function MedSAMAnnotator({
    imageUrl,
    imageId,
    onSegmentationApproved,
    laterality,
    viewPosition,
}: MedSAMAnnotatorProps) {
    // State
    const [isDrawing, setIsDrawing] = useState(false)
    const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
    const [currentBox, setCurrentBox] = useState<BBox | null>(null)
    const [confirmedBox, setConfirmedBox] = useState<BBox | null>(null)

    const [isProcessing, setIsProcessing] = useState(false)
    const [result, setResult] = useState<MedSAMResult | null>(null)
    const [overlayUrl, setOverlayUrl] = useState<string | null>(null)
    const [showOverlay, setShowOverlay] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isExpanded, setIsExpanded] = useState(true)

    // Image dimensions (natural vs displayed)
    const [imgNatural, setImgNatural] = useState({ w: 1, h: 1 })
    const [imgDisplay, setImgDisplay] = useState({ w: 1, h: 1, left: 0, top: 0 })

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const imgRef = useRef<HTMLImageElement>(null)

    // ─── Coordinate Mapping ───────────────────────────────────────────

    const updateDisplayDimensions = useCallback(() => {
        if (!imgRef.current || !containerRef.current) return
        const img = imgRef.current
        const container = containerRef.current
        const containerRect = container.getBoundingClientRect()

        // The image is object-fit: contain, so we need the *actual rendered* size
        const imgAspect = img.naturalWidth / img.naturalHeight
        const containerAspect = containerRect.width / containerRect.height

        let dispW: number, dispH: number, offsetX: number, offsetY: number

        if (imgAspect > containerAspect) {
            dispW = containerRect.width
            dispH = containerRect.width / imgAspect
            offsetX = 0
            offsetY = (containerRect.height - dispH) / 2
        } else {
            dispH = containerRect.height
            dispW = containerRect.height * imgAspect
            offsetX = (containerRect.width - dispW) / 2
            offsetY = 0
        }

        setImgNatural({ w: img.naturalWidth, h: img.naturalHeight })
        setImgDisplay({ w: dispW, h: dispH, left: offsetX, top: offsetY })

        // Resize canvas to match container
        const canvas = canvasRef.current
        if (canvas) {
            canvas.width = containerRect.width
            canvas.height = containerRect.height
        }
    }, [])

    useEffect(() => {
        updateDisplayDimensions()
        window.addEventListener("resize", updateDisplayDimensions)
        return () => window.removeEventListener("resize", updateDisplayDimensions)
    }, [updateDisplayDimensions])

    /** Convert screen coords (relative to canvas) → original image pixel coords */
    const screenToImage = useCallback(
        (sx: number, sy: number) => {
            const ix = ((sx - imgDisplay.left) / imgDisplay.w) * imgNatural.w
            const iy = ((sy - imgDisplay.top) / imgDisplay.h) * imgNatural.h
            return {
                x: Math.max(0, Math.min(imgNatural.w, Math.round(ix))),
                y: Math.max(0, Math.min(imgNatural.h, Math.round(iy))),
            }
        },
        [imgDisplay, imgNatural],
    )

    /** Convert original image coords → screen coords (relative to canvas) */
    const imageToScreen = useCallback(
        (ix: number, iy: number) => ({
            x: (ix / imgNatural.w) * imgDisplay.w + imgDisplay.left,
            y: (iy / imgNatural.h) * imgDisplay.h + imgDisplay.top,
        }),
        [imgDisplay, imgNatural],
    )

    // ─── Canvas Drawing ───────────────────────────────────────────────

    const drawCanvas = useCallback(
        (box: BBox | null) => {
            const canvas = canvasRef.current
            if (!canvas) return
            const ctx = canvas.getContext("2d")
            if (!ctx) return

            ctx.clearRect(0, 0, canvas.width, canvas.height)

            if (!box) return

            const tl = imageToScreen(box.x1, box.y1)
            const br = imageToScreen(box.x2, box.y2)
            const w = br.x - tl.x
            const h = br.y - tl.y

            // Semi-transparent overlay OUTSIDE the box (darken surroundings)
            ctx.fillStyle = "rgba(0, 0, 0, 0.35)"
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.clearRect(tl.x, tl.y, w, h)

            // Animated dashed border
            ctx.strokeStyle = "#00e5ff"
            ctx.lineWidth = 2.5
            ctx.setLineDash([8, 4])
            ctx.lineDashOffset = -(Date.now() / 50) % 12
            ctx.strokeRect(tl.x, tl.y, w, h)
            ctx.setLineDash([])

            // Corner handles
            const handleSize = 8
            ctx.fillStyle = "#00e5ff"
            const corners = [
                [tl.x, tl.y],
                [br.x, tl.y],
                [tl.x, br.y],
                [br.x, br.y],
            ]
            for (const [cx, cy] of corners) {
                ctx.beginPath()
                ctx.arc(cx, cy, handleSize / 2, 0, Math.PI * 2)
                ctx.fill()
            }

            // Dimension label
            const boxW = box.x2 - box.x1
            const boxH = box.y2 - box.y1
            const label = `${boxW} × ${boxH} px`
            ctx.font = "11px monospace"
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
            const textMetrics = ctx.measureText(label)
            const labelX = tl.x
            const labelY = tl.y - 8
            ctx.fillRect(labelX - 2, labelY - 12, textMetrics.width + 6, 16)
            ctx.fillStyle = "#00e5ff"
            ctx.fillText(label, labelX + 1, labelY)
        },
        [imageToScreen],
    )

    // Animate dashed border when drawing
    useEffect(() => {
        if (!currentBox && !confirmedBox) return
        const box = confirmedBox || currentBox
        let animId: number
        const animate = () => {
            drawCanvas(box)
            animId = requestAnimationFrame(animate)
        }
        animate()
        return () => cancelAnimationFrame(animId)
    }, [currentBox, confirmedBox, drawCanvas])

    // ─── Mouse Handlers ───────────────────────────────────────────────

    const getCanvasCoords = (e: React.MouseEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return { x: 0, y: 0 }
        const rect = canvas.getBoundingClientRect()
        return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isProcessing || result) return
        e.preventDefault()
        const pos = getCanvasCoords(e)
        setDrawStart(pos)
        setIsDrawing(true)
        setConfirmedBox(null)
        setCurrentBox(null)
        setError(null)
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || !drawStart) return
        const pos = getCanvasCoords(e)
        const imgStart = screenToImage(drawStart.x, drawStart.y)
        const imgEnd = screenToImage(pos.x, pos.y)

        setCurrentBox({
            x1: Math.min(imgStart.x, imgEnd.x),
            y1: Math.min(imgStart.y, imgEnd.y),
            x2: Math.max(imgStart.x, imgEnd.x),
            y2: Math.max(imgStart.y, imgEnd.y),
        })
    }

    const handleMouseUp = () => {
        if (!isDrawing || !currentBox) {
            setIsDrawing(false)
            return
        }
        setIsDrawing(false)

        // Require minimum box size (at least 10px in each direction)
        const w = currentBox.x2 - currentBox.x1
        const h = currentBox.y2 - currentBox.y1
        if (w < 10 || h < 10) {
            setCurrentBox(null)
            setError("Box too small — draw a larger region")
            return
        }

        setConfirmedBox(currentBox)
        setCurrentBox(null)
    }

    // ─── MedSAM API Call ──────────────────────────────────────────────

    const runSegmentation = async () => {
        if (!confirmedBox) return

        setIsProcessing(true)
        setError(null)
        setResult(null)
        setOverlayUrl(null)

        try {
            // Fetch the image blob to send to the backend
            const imageResponse = await fetch(imageUrl)
            if (!imageResponse.ok) throw new Error("Failed to fetch image for segmentation")
            const imageBlob = await imageResponse.blob()

            const formData = new FormData()
            formData.append("file", imageBlob, "mammogram.jpg")
            formData.append("x1", String(confirmedBox.x1))
            formData.append("y1", String(confirmedBox.y1))
            formData.append("x2", String(confirmedBox.x2))
            formData.append("y2", String(confirmedBox.y2))

            const response = await fetch("/api/medsam", {
                method: "POST",
                body: formData,
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || data.detail || `Segmentation failed (${response.status})`)
            }

            const data: MedSAMResult = await response.json()
            setResult(data)

            // Set overlay URL
            if (data.overlay_reference) {
                setOverlayUrl(`/api/medsam/overlay/${data.overlay_reference}`)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Segmentation failed")
        } finally {
            setIsProcessing(false)
        }
    }

    // ─── Actions ──────────────────────────────────────────────────────

    const handleReset = () => {
        setConfirmedBox(null)
        setCurrentBox(null)
        setResult(null)
        setOverlayUrl(null)
        setError(null)
        setShowOverlay(true)
        drawCanvas(null)
    }

    const handleApprove = () => {
        if (result && onSegmentationApproved) {
            onSegmentationApproved(result)
        }
    }

    // ─── Render ───────────────────────────────────────────────────────

    return (
        <div className="medsam-annotator" id="medsam-annotator">
            {/* Header / Toggle */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="medsam-header"
                id="medsam-toggle"
            >
                <div className="medsam-header-left">
                    <div className="medsam-icon-badge">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <span className="medsam-title">MedSAM Tumor Segmentation</span>
                        <span className="medsam-subtitle">Draw a box → AI highlights the tumor</span>
                    </div>
                </div>
                <div className="medsam-header-right">
                    <span className="medsam-badge">Zero-Shot AI</span>
                    {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                </div>
            </button>

            {isExpanded && (
                <div className="medsam-body">
                    {/* Instructions */}
                    <div className="medsam-instructions">
                        <div className="medsam-step">
                            <div className="medsam-step-num">1</div>
                            <span>Draw a bounding box around the suspicious region</span>
                        </div>
                        <div className="medsam-step-arrow">→</div>
                        <div className="medsam-step">
                            <div className="medsam-step-num">2</div>
                            <span>AI segments the exact tumor boundary</span>
                        </div>
                        <div className="medsam-step-arrow">→</div>
                        <div className="medsam-step">
                            <div className="medsam-step-num">3</div>
                            <span>Approve & include in patient report</span>
                        </div>
                    </div>

                    {/* Canvas Area */}
                    <div
                        ref={containerRef}
                        className="medsam-canvas-container"
                        id="medsam-canvas-area"
                    >
                        {/* Background mammogram image */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            ref={imgRef}
                            src={result && overlayUrl && showOverlay ? overlayUrl : imageUrl}
                            alt={`${laterality ?? ""} ${viewPosition ?? ""} mammogram`}
                            className="medsam-base-image"
                            onLoad={updateDisplayDimensions}
                            draggable={false}
                        />

                        {/* Drawing canvas overlay */}
                        <canvas
                            ref={canvasRef}
                            className="medsam-draw-canvas"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            style={{
                                cursor: isProcessing || result
                                    ? "default"
                                    : isDrawing
                                        ? "crosshair"
                                        : "crosshair",
                            }}
                        />

                        {/* Status overlays */}
                        {isProcessing && (
                            <div className="medsam-status-overlay">
                                <div className="medsam-processing-card">
                                    <div className="medsam-processing-spinner">
                                        <Loader2 className="w-8 h-8 animate-spin" />
                                    </div>
                                    <p className="medsam-processing-title">
                                        MedSAM Processing…
                                    </p>
                                    <p className="medsam-processing-sub">
                                        AI is analyzing the region you selected
                                    </p>
                                    <div className="medsam-processing-bar">
                                        <div className="medsam-processing-bar-fill" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Position labels */}
                        {(laterality || viewPosition) && (
                            <div className="medsam-position-label">
                                {laterality} {viewPosition}
                            </div>
                        )}

                        {/* Crosshair instruction when no box */}
                        {!confirmedBox && !currentBox && !result && !isDrawing && (
                            <div className="medsam-crosshair-hint">
                                <Crosshair className="w-5 h-5" />
                                <span>Click & drag to draw a box</span>
                            </div>
                        )}
                    </div>

                    {/* Action Bar */}
                    <div className="medsam-actions">
                        {/* Left: info */}
                        <div className="medsam-actions-left">
                            {confirmedBox && !result && (
                                <span className="medsam-bbox-info">
                                    <Box className="w-3.5 h-3.5" />
                                    Box: ({confirmedBox.x1}, {confirmedBox.y1}) → ({confirmedBox.x2}, {confirmedBox.y2})
                                </span>
                            )}
                            {result && (
                                <div className="medsam-result-info">
                                    <span className={`medsam-result-badge ${result.tumor_detected ? "detected" : "clear"}`}>
                                        {result.tumor_detected ? "Tumor Detected" : "No Tumor Detected"}
                                    </span>
                                    <span className="medsam-area-fraction">
                                        Area: {(result.tumor_area_fraction * 100).toFixed(2)}%
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Right: buttons */}
                        <div className="medsam-actions-right">
                            {/* Toggle overlay */}
                            {result && overlayUrl && (
                                <button
                                    onClick={() => setShowOverlay(!showOverlay)}
                                    className="medsam-btn medsam-btn-ghost"
                                    title={showOverlay ? "Show original" : "Show overlay"}
                                >
                                    <Maximize2 className="w-4 h-4" />
                                    {showOverlay ? "Original" : "Overlay"}
                                </button>
                            )}

                            {/* Reset */}
                            <button
                                onClick={handleReset}
                                className="medsam-btn medsam-btn-secondary"
                                disabled={isProcessing}
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset
                            </button>

                            {/* Run Segmentation */}
                            {confirmedBox && !result && (
                                <button
                                    onClick={runSegmentation}
                                    disabled={isProcessing}
                                    className="medsam-btn medsam-btn-primary"
                                    id="medsam-run-btn"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Segmenting…
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Run MedSAM
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Approve */}
                            {result && (
                                <button
                                    onClick={handleApprove}
                                    className="medsam-btn medsam-btn-approve"
                                    id="medsam-approve-btn"
                                >
                                    <Check className="w-4 h-4" />
                                    Approve for Report
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Error display */}
                    {error && (
                        <div className="medsam-error">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Advisory */}
                    <div className="medsam-advisory">
                        <strong>Advisory:</strong> MedSAM segmentation is for assistance only.
                        Your clinical judgment is the final authority.
                    </div>
                </div>
            )}
        </div>
    )
}
