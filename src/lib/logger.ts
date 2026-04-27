/**
 * Structured JSON logger for the web application.
 *
 * Outputs machine-parseable JSON lines compatible with ELK, Loki,
 * CloudWatch, and other log aggregation systems.
 *
 * Usage:
 *   import { logger } from "@/lib/logger"
 *   logger.info("User logged in", { userId: "abc", role: "DOCTOR" })
 */

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
    timestamp: string
    level: LogLevel
    message: string
    [key: string]: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
}

// Minimum log level — controlled via LOG_LEVEL env var
const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "info" : "debug")

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[minLevel]
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog(level)) return

    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...(meta || {}),
    }

    const line = JSON.stringify(entry)

    switch (level) {
        case "error":
            console.error(line)
            break
        case "warn":
            console.warn(line)
            break
        default:
            console.log(line)
    }
}

export const logger = {
    debug: (message: string, meta?: Record<string, unknown>) => emit("debug", message, meta),
    info: (message: string, meta?: Record<string, unknown>) => emit("info", message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => emit("warn", message, meta),
    error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta),
}
