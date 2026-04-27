/**
 * Redis client wrapper for caching.
 *
 * Provides cache helpers with graceful degradation — if Redis is
 * unavailable the application continues to work without caching.
 */

import Redis from "ioredis"

// ─── Connection ─────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"

let redisClient: Redis | null = null
let connectionFailed = false

function getClient(): Redis | null {
    if (connectionFailed) return null
    if (redisClient) return redisClient

    try {
        redisClient = new Redis(REDIS_URL, {
            maxRetriesPerRequest: 1,
            retryStrategy(times) {
                if (times > 3) {
                    connectionFailed = true
                    console.warn("[Redis] Connection failed after 3 retries — caching disabled")
                    return null
                }
                return Math.min(times * 200, 2000)
            },
            lazyConnect: true,
        })

        redisClient.on("error", (err) => {
            console.warn("[Redis] Connection error:", err.message)
        })

        redisClient.connect().catch(() => {
            connectionFailed = true
            redisClient = null
        })

        return redisClient
    } catch {
        connectionFailed = false
        return null
    }
}

// ─── Cache Helpers ──────────────────────────────────────────────────────────

/**
 * Retrieve a cached value by key.
 * Returns `null` on miss or if Redis is unavailable.
 */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
    const client = getClient()
    if (!client) return null

    try {
        const raw = await client.get(key)
        return raw ? (JSON.parse(raw) as T) : null
    } catch {
        return null
    }
}

/**
 * Store a value in cache with a TTL (in seconds).
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const client = getClient()
    if (!client) return

    try {
        await client.set(key, JSON.stringify(value), "EX", ttlSeconds)
    } catch {
        // Swallow — caching is best-effort
    }
}

/**
 * Delete a cached entry.
 */
export async function cacheDelete(key: string): Promise<void> {
    const client = getClient()
    if (!client) return

    try {
        await client.del(key)
    } catch {
        // Swallow
    }
}

/**
 * Ping Redis to check connectivity.
 * Returns true if Redis responds with "PONG".
 */
export async function redisPing(): Promise<boolean> {
    const client = getClient()
    if (!client) return false

    try {
        const result = await client.ping()
        return result === "PONG"
    } catch {
        return false
    }
}
