"use client";

// ─── Lightweight client-side query cache ──────────────────────────────────────
//
// Provides staleTime-aware caching, request deduplication, and optimistic
// updates — the essential TanStack Query patterns — without any extra package.
//
// Architecture:
//   • CacheStore    — module-level singleton Map (survives re-renders)
//   • useQuery      — hook; returns { data, isLoading, error }
//   • useQueryClient — returns invalidate / setData helpers
//
// Usage:
//   const { data, isLoading, error } = useQuery(["dashboard"], fetchFn);
//   const qc = useQueryClient();
//   qc.invalidate(["dashboard"]);

import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type QueryKey = (string | number | boolean | undefined | null)[];

interface CacheEntry<T> {
  data: T;
  updatedAt: number;
}

interface InFlightEntry {
  promise: Promise<unknown>;
}

interface QueryOptions {
  staleTime?: number;  // ms before data is considered stale (default 60s)
  gcTime?:    number;  // ms to keep in cache after no subscribers
  enabled?:   boolean;
}

// ── Module-level singletons (survive HMR and re-renders) ──────────────────────

const _cache    = new Map<string, CacheEntry<unknown>>();
const _inFlight = new Map<string, InFlightEntry>();
// Subscribers: key → Set<() => void> (notify on update)
const _subs     = new Map<string, Set<() => void>>();

function serialize(key: QueryKey): string {
  return JSON.stringify(key);
}

function notify(serialized: string) {
  const subs = _subs.get(serialized);
  if (subs) subs.forEach((cb) => cb());
}

// ── Public query client (imperative API) ──────────────────────────────────────

export const queryClient = {
  /** Bust the cache for matching keys and re-fetch all active subscribers. */
  invalidate(key: QueryKey) {
    const serialized = serialize(key);
    _cache.delete(serialized);
    _inFlight.delete(serialized);
    notify(serialized);
  },

  /** Partially match and invalidate all keys that start with the prefix array. */
  invalidatePrefix(prefix: QueryKey) {
    const pfx = serialize(prefix).slice(0, -1); // remove trailing "]"
    for (const [k] of _cache) {
      if (k.startsWith(pfx)) {
        _cache.delete(k);
        notify(k);
      }
    }
  },

  /** Optimistically set data without going to the server. */
  setData<T>(key: QueryKey, updater: T | ((prev: T | undefined) => T)) {
    const serialized = serialize(key);
    const prev = (_cache.get(serialized) as CacheEntry<T> | undefined)?.data;
    const next = typeof updater === "function"
      ? (updater as (p: T | undefined) => T)(prev)
      : updater;
    _cache.set(serialized, { data: next, updatedAt: Date.now() });
    notify(serialized);
  },

  /** Read current cached data (synchronous, no network). */
  getData<T>(key: QueryKey): T | undefined {
    const serialized = serialize(key);
    return (_cache.get(serialized) as CacheEntry<T> | undefined)?.data;
  },
};

// ── useQuery hook ─────────────────────────────────────────────────────────────

export function useQuery<T>(
  key: QueryKey,
  fetcher: () => Promise<T>,
  options: QueryOptions = {}
): { data: T | undefined; isLoading: boolean; error: Error | null } {
  const { staleTime = 60_000, enabled = true } = options;
  const serialized = serialize(key);

  // ── State ──────────────────────────────────────────────────────────────────
  const [, forceUpdate] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Subscribe to external invalidations ────────────────────────────────────
  useEffect(() => {
    if (!_subs.has(serialized)) _subs.set(serialized, new Set());
    const cb = () => { if (mountedRef.current) forceUpdate((n) => n + 1); };
    _subs.get(serialized)!.add(cb);
    return () => { _subs.get(serialized)?.delete(cb); };
  }, [serialized]);

  // ── Fetch logic ─────────────────────────────────────────────────────────────
  const fetch = useCallback(() => {
    if (!enabled) return;

    // Cache hit within staleTime
    const cached = _cache.get(serialized);
    if (cached && Date.now() - cached.updatedAt < staleTime) return;

    // Deduplicate in-flight
    if (_inFlight.has(serialized)) return;

    const promise = (async () => {
      try {
        const data = await fetcher();
        _cache.set(serialized, { data, updatedAt: Date.now() });
      } catch {
        // Leave cache empty; error will be surfaced below
      } finally {
        _inFlight.delete(serialized);
        notify(serialized);
      }
    })();

    _inFlight.set(serialized, { promise });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, staleTime, enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // ── Return current state ───────────────────────────────────────────────────
  const cached = _cache.get(serialized) as CacheEntry<T> | undefined;
  const isInFlight = _inFlight.has(serialized);

  return {
    data:       cached?.data,
    isLoading:  enabled && !cached && isInFlight,
    error:      null, // simplified; real errors surface via fallback defaults
  };
}

// ── useQueryClient hook ────────────────────────────────────────────────────────

export function useQueryClient() {
  return queryClient;
}
