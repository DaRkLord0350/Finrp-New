// ============================================================
// FinRP — Redis Client (caching + distributed locks ONLY)
//
// Redis is no longer used for background jobs/queues — those moved to
// Inngest. This module backs the cache layer (lib/cache) and the
// signup distributed lock. If REDIS_URL is unset everything degrades
// gracefully to "no cache" via the circuit breaker below.
//
// Design principles:
//   1. maxRetriesPerRequest: 0  — fail fast, never block a request
//   2. enableOfflineQueue: false — reject commands immediately when disconnected
//   3. lazyConnect: true        — don't connect at import time
//   4. Circuit breaker          — after 5 failures, bypass Redis for 30s
//   5. TLS auto-detect          — rediss:// activates tls config
// ============================================================

import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;
const effectiveRedisUrl = REDIS_URL || "redis://localhost:6379";
const isTLS     = effectiveRedisUrl.startsWith("rediss://");

// ---------------------------------------------------------------------------
// Circuit breaker
// After THRESHOLD consecutive failures the circuit opens for RESET_MS.
// While open, all cache operations return null/void immediately so the
// app runs on DB alone without burning retries or blocking requests.
// ---------------------------------------------------------------------------
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_MS  = 30_000; // 30 s

let _failures  = 0;
let _openUntil = 0;

function circuitIsOpen(): boolean {
  if (_openUntil > 0 && _openUntil <= Date.now()) {
    _failures  = 0;
    _openUntil = 0;
    console.log("[Redis] circuit HALF-OPEN — testing connection");
  }
  return Date.now() < _openUntil;
}

function recordRedisSuccess(): void {
  if (_failures > 0) {
    _failures  = 0;
    _openUntil = 0;
    console.log("[Redis] circuit CLOSED — connection restored");
  }
}

function recordRedisFailure(): void {
  _failures++;
  if (_failures >= CIRCUIT_THRESHOLD && _openUntil === 0) {
    _openUntil = Date.now() + CIRCUIT_RESET_MS;
    console.warn(
      `[Redis] circuit OPEN — ${_failures} consecutive failures, bypassing Redis for ${CIRCUIT_RESET_MS / 1_000}s`
    );
  }
}

// ---------------------------------------------------------------------------
// Singleton cache client (ioredis — for non-BullMQ use)
// ---------------------------------------------------------------------------
let _cacheClient: IORedis | null = null;

export function getCacheClient(): IORedis {
  if (_cacheClient) return _cacheClient;

  _cacheClient = new IORedis(effectiveRedisUrl, {
    // ── Fail-fast settings ──────────────────────────────────────────────────
    maxRetriesPerRequest: 0,      // never retry a command; throw immediately
    enableReadyCheck:     false,  // don't wait for READYCHECK handshake
    lazyConnect:          true,   // don't connect at construction time
    enableOfflineQueue:   false,  // reject commands when not connected (no queuing)

    // ── Connection settings ─────────────────────────────────────────────────
    connectTimeout:  3_000,  // 3 s to establish TCP connection
    keepAlive:       10_000, // TCP keepalive every 10 s

    // ── Reconnect backoff ──────────────────────────────────────────────────
    // Exponential backoff capped at 5 s; give up after 20 attempts (~100 s total)
    retryStrategy: (times: number) =>
      times > 20 ? null : Math.min(times * 200, 5_000),

    // ── TLS for Upstash / Railway Redis ────────────────────────────────────
    ...(isTLS ? { tls: { rejectUnauthorized: false } } : {}),

    reconnectOnError: (err: Error) => err.message.includes("READONLY"),
  });

  _cacheClient.on("error", (err: Error) => {
    recordRedisFailure();
    // Only log the first two failures per circuit-open window to avoid log spam
    if (_failures <= 2) {
      console.error(`[Redis] ${err.message}`);
    }
  });

  _cacheClient.on("connect", () => {
    recordRedisSuccess();
    console.log("[Redis] connected");
  });

  _cacheClient.on("reconnecting", () => {
    console.log("[Redis] reconnecting…");
  });

  return _cacheClient;
}

// ---------------------------------------------------------------------------
// get / set / del — circuit breaker guarded
// All errors are caught here so a Redis outage NEVER surfaces as a 500.
// ---------------------------------------------------------------------------
export async function redisGet(key: string): Promise<string | null> {
  if (circuitIsOpen()) return null;
  try {
    const v = await getCacheClient().get(key);
    if (v !== null) recordRedisSuccess();
    return v;
  } catch {
    recordRedisFailure();
    return null;
  }
}

export async function redisSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  if (circuitIsOpen()) return;
  try {
    const c = getCacheClient();
    if (ttlSeconds) {
      await c.setex(key, ttlSeconds, value);
    } else {
      await c.set(key, value);
    }
    recordRedisSuccess();
  } catch {
    recordRedisFailure();
  }
}

export async function redisDel(key: string): Promise<void> {
  if (circuitIsOpen()) return;
  try {
    await getCacheClient().del(key);
    recordRedisSuccess();
  } catch {
    recordRedisFailure();
  }
}

// ---------------------------------------------------------------------------
// Distributed lock (SETNX pattern)
// Used by provisionUser() to serialize concurrent signups for the same clerkId.
// Returns true if the lock was acquired, false otherwise (Redis down or
// another instance holds the lock).
// ---------------------------------------------------------------------------
export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  if (circuitIsOpen()) return false;
  try {
    const result = await getCacheClient().set(key, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch {
    return false;
  }
}

export async function releaseLock(key: string): Promise<void> {
  if (circuitIsOpen()) return;
  try {
    await getCacheClient().del(key);
  } catch {
    // best-effort; TTL will expire the lock automatically
  }
}

// ---------------------------------------------------------------------------
// Health check — used by /api/health route
// ---------------------------------------------------------------------------
export async function redisHealthCheck(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  circuitOpen: boolean;
  failures: number;
  error?: string;
}> {
  const circuitOpen = circuitIsOpen();
  if (circuitOpen) {
    return { healthy: false, circuitOpen: true, failures: _failures };
  }

  const start = Date.now();
  try {
    await getCacheClient().ping();
    return {
      healthy:     true,
      latencyMs:   Date.now() - start,
      circuitOpen: false,
      failures:    0,
    };
  } catch (err) {
    return {
      healthy:     false,
      circuitOpen: false,
      failures:    _failures,
      error:       (err as Error).message,
    };
  }
}

// ---------------------------------------------------------------------------
// Graceful shutdown — call before process.exit()
// ---------------------------------------------------------------------------
export async function closeAllRedisConnections(): Promise<void> {
  if (_cacheClient) {
    await _cacheClient.quit();
    _cacheClient = null;
    console.log("[Redis] connection closed");
  }
}
