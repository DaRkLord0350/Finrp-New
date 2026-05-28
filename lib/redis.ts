// ============================================================
// FinRP — Redis Connection
//
// BullMQ bundles its own ioredis copy internally, so passing
// an ioredis instance from the top-level package causes a
// structural type mismatch at compile time. Instead we:
//
//   1. Export plain ConnectionOptions for BullMQ (Queue/Worker)
//      so BullMQ creates its own internal connection.
//   2. Keep a direct ioredis singleton for non-BullMQ operations
//      (caching, token storage, rate-limit counters, etc.)
// ============================================================

import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// ---------------------------------------------------------------------------
// Parse Redis URL → plain options object
// Supports: redis://[:password@]host[:port][/db]
// ---------------------------------------------------------------------------
function parseRedisUrl(url: string): {
  host: string;
  port: number;
  password?: string;
  db?: number;
} {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port || "6379", 10),
      password: parsed.password || undefined,
      db: parsed.pathname && parsed.pathname !== "/" ? parseInt(parsed.pathname.slice(1), 10) || 0 : undefined,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

const baseUrl = parseRedisUrl(REDIS_URL);

// ---------------------------------------------------------------------------
// BullMQ-compatible connection options (plain object — no ioredis instance)
// BullMQ Queue / Worker / QueueEvents accept this directly.
// ---------------------------------------------------------------------------
export const BULLMQ_CONNECTION = {
  ...baseUrl,
  maxRetriesPerRequest: null as null, // required by BullMQ
  enableReadyCheck: false,            // required by BullMQ
};

/**
 * Returns BullMQ-compatible connection options.
 * Use this everywhere you pass `connection:` to Queue / Worker / QueueEvents.
 * The `_role` parameter is kept for backwards compat — it has no effect since
 * each BullMQ primitive creates its own internal ioredis connection.
 */
export function getRedisConnection(
  _role: "queue" | "worker" | "events" | "cache" = "queue"
): typeof BULLMQ_CONNECTION {
  return BULLMQ_CONNECTION;
}

// ---------------------------------------------------------------------------
// Direct ioredis client — for NON-BullMQ use (cache, token storage, etc.)
// ---------------------------------------------------------------------------
let _cacheClient: IORedis | null = null;

export function getCacheClient(): IORedis {
  if (!_cacheClient) {
    _cacheClient = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy: (times: number) => Math.min(times * 500, 5_000),
      reconnectOnError: (err: Error) => err.message.includes("READONLY"),
    });

    _cacheClient.on("error", (err: Error) => {
      console.error("[Redis:cache] error:", err.message);
    });
  }
  return _cacheClient;
}

// ---------------------------------------------------------------------------
// Simple get/set/del helpers (use direct ioredis client, not BullMQ)
// ---------------------------------------------------------------------------
export async function redisGet(key: string): Promise<string | null> {
  return getCacheClient().get(key);
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const conn = getCacheClient();
  if (ttlSeconds) {
    await conn.setex(key, ttlSeconds, value);
  } else {
    await conn.set(key, value);
  }
}

export async function redisDel(key: string): Promise<void> {
  await getCacheClient().del(key);
}

/** Graceful shutdown — call before process.exit() */
export async function closeAllRedisConnections(): Promise<void> {
  if (_cacheClient) {
    await _cacheClient.quit();
    _cacheClient = null;
    console.log("[Redis:cache] closed");
  }
}
