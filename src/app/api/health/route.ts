/**
 * Application Health Check Endpoint
 *
 * GET /api/health
 *
 * Checks connectivity to all backing services and returns a
 * structured response suitable for uptime monitoring and APM tools.
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { redisPing } from "@/lib/redis"
import { checkMLServiceHealth } from "@/lib/ml-service"

interface DependencyStatus {
    status: "healthy" | "unhealthy"
    latencyMs: number
    error?: string
}

interface HealthResponse {
    status: "healthy" | "degraded" | "unhealthy"
    timestamp: string
    uptime: number
    dependencies: {
        database: DependencyStatus
        redis: DependencyStatus
        mlService: DependencyStatus
    }
}

const startTime = Date.now()

async function checkDatabase(): Promise<DependencyStatus> {
    const start = Date.now()
    try {
        await prisma.$queryRaw`SELECT 1`
        return { status: "healthy", latencyMs: Date.now() - start }
    } catch (err) {
        return {
            status: "unhealthy",
            latencyMs: Date.now() - start,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

async function checkRedis(): Promise<DependencyStatus> {
    const start = Date.now()
    try {
        const ok = await redisPing()
        return {
            status: ok ? "healthy" : "unhealthy",
            latencyMs: Date.now() - start,
            ...(ok ? {} : { error: "Ping failed" }),
        }
    } catch (err) {
        return {
            status: "unhealthy",
            latencyMs: Date.now() - start,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

async function checkML(): Promise<DependencyStatus> {
    const start = Date.now()
    try {
        const health = await checkMLServiceHealth()
        const isHealthy = health.status === "healthy" && health.model_loaded
        return {
            status: isHealthy ? "healthy" : "unhealthy",
            latencyMs: Date.now() - start,
            ...(isHealthy ? {} : { error: `status=${health.status}, model_loaded=${health.model_loaded}` }),
        }
    } catch (err) {
        return {
            status: "unhealthy",
            latencyMs: Date.now() - start,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

export async function GET() {
    const [database, redis, mlService] = await Promise.all([
        checkDatabase(),
        checkRedis(),
        checkML(),
    ])

    const deps = { database, redis, mlService }
    const allHealthy = Object.values(deps).every((d) => d.status === "healthy")
    const anyHealthy = Object.values(deps).some((d) => d.status === "healthy")

    const overallStatus: HealthResponse["status"] = allHealthy
        ? "healthy"
        : anyHealthy
            ? "degraded"
            : "unhealthy"

    const response: HealthResponse = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        dependencies: deps,
    }

    return NextResponse.json(response, {
        status: overallStatus === "unhealthy" ? 503 : 200,
    })
}
