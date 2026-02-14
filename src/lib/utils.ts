import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Generate a pseudonymized patient ID
 * Used to de-identify patient data while maintaining linkage
 */
export function generatePseudonymId(): string {
    const timestamp = Date.now().toString(36)
    const randomPart = Math.random().toString(36).substring(2, 10)
    return `PSN-${timestamp}-${randomPart}`.toUpperCase()
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(new Date(date))
}

/**
 * Format datetime for display
 */
export function formatDateTime(date: Date | string): string {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(date))
}

/**
 * Get risk tier display color
 */
export function getRiskTierColor(tier: string): string {
    const colors: Record<string, string> = {
        LOW: 'text-green-600 bg-green-50 border-green-200',
        MODERATE: 'text-yellow-600 bg-yellow-50 border-yellow-200',
        ELEVATED: 'text-orange-600 bg-orange-50 border-orange-200',
        HIGH: 'text-red-600 bg-red-50 border-red-200',
    }
    return colors[tier] || 'text-gray-600 bg-gray-50 border-gray-200'
}

/**
 * Get case status display color
 */
export function getCaseStatusColor(status: string): string {
    const colors: Record<string, string> = {
        PENDING_REVIEW: 'text-blue-600 bg-blue-50',
        UNDER_REVIEW: 'text-yellow-600 bg-yellow-50',
        REVIEWED: 'text-green-600 bg-green-50',
        CLOSED: 'text-gray-600 bg-gray-50',
    }
    return colors[status] || 'text-gray-600 bg-gray-50'
}

/**
 * Sanitize file name for storage
 */
export function sanitizeFileName(fileName: string): string {
    return fileName
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_')
        .toLowerCase()
}
