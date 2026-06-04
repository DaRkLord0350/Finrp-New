import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// ─── Typed global ─────────────────────────────────────────────────────────────
// Stored on globalThis so both the pool AND the client survive:
//   • HMR module re-evaluation in dev (Next.js replaces modules on save)
//   • Back-to-back module imports in the same serverless invocation
//
// Previously: only `prisma` was guarded by globalThis, AND only in dev.
// Bug: a new `Pool` was created on every module evaluation regardless of
// environment, leaking connections in dev and wasting them in serverless.
// Fix: guard BOTH pool and client in globalThis, in ALL environments.
const _g = globalThis as unknown as {
  _prismaPool:   Pool         | undefined;
  _prismaClient: PrismaClient | undefined;
};

// ---------------------------------------------------------------------------
// Pool singleton
//
// DEFAULT max=5 to keep total connections across the main app process and
// the BullMQ worker process comfortably under the Supabase free-tier limit
// (15 session-mode slots).  Tune per deployment:
//
//   Supabase free, single process → DATABASE_POOL_MAX=12
//   Supabase free, app + worker   → app=5, worker=3  (set per PM2 app)
//   Vercel serverless             → DATABASE_POOL_MAX=1 (transaction-mode URL)
//   Supabase Pro / dedicated      → DATABASE_POOL_MAX=20+
//
// connectionTimeoutMillis=5000: fail fast when the pool is exhausted rather
// than queuing indefinitely; surfaces misconfiguration earlier and prevents
// cascading slowdowns.
// ---------------------------------------------------------------------------
function getPool(): Pool {
  if (_g._prismaPool) return _g._prismaPool;

  const pool = new Pool({
    connectionString:        process.env.DATABASE_URL,
    max:                     parseInt(process.env.DATABASE_POOL_MAX ?? "5", 10),
    idleTimeoutMillis:       10_000, // release idle connections after 10 s
    connectionTimeoutMillis: 5_000,  // fail fast if pool is full
    allowExitOnIdle:         true,
  });

  pool.on("error", (err) => {
    console.error("[pg-pool] idle client error:", err.message);
  });

  _g._prismaPool = pool;
  return pool;
}

// ---------------------------------------------------------------------------
// PrismaClient singleton
// ---------------------------------------------------------------------------
function makePrismaClient(): PrismaClient {
  if (_g._prismaClient) return _g._prismaClient;

  const client = new PrismaClient({
    adapter: new PrismaPg(getPool()),
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

  _g._prismaClient = client;
  return client;
}

export const prisma = makePrismaClient();

// ---------------------------------------------------------------------------
// Connection pool metrics — for /api/health
// pg.Pool exposes these counters synchronously; safe to call any time.
// ---------------------------------------------------------------------------
export function getPoolMetrics() {
  const pool = _g._prismaPool;
  if (!pool) return { total: 0, idle: 0, waiting: 0, max: 0 };
  return {
    total:   pool.totalCount,
    idle:    pool.idleCount,
    waiting: pool.waitingCount,
    max:     parseInt(process.env.DATABASE_POOL_MAX ?? "5", 10),
  };
}
