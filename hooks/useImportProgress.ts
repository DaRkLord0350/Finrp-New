// ============================================================
// FinRP — useImportProgress Hook
// Connects to the SSE endpoint and streams real-time progress
// for a BullMQ import job. Handles reconnect on error.
// ============================================================

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportStatus =
  | "PENDING"
  | "MAPPING"
  | "VALIDATING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "PARTIAL";

export interface ImportProgress {
  status: ImportStatus;
  progress: number;           // 0-100
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  skippedRows: number;
  duplicateRows: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface UseImportProgressOptions {
  /** Called when a progress update arrives */
  onProgress?: (progress: ImportProgress) => void;
  /** Called when import reaches a terminal state */
  onComplete?: (progress: ImportProgress) => void;
  /** Called on SSE connection error */
  onError?: (error: Event) => void;
  /** Max reconnect attempts (default: 5) */
  maxRetries?: number;
  /** Whether to auto-start streaming (default: true) */
  enabled?: boolean;
}

export interface UseImportProgressReturn {
  progress: ImportProgress | null;
  isConnected: boolean;
  isComplete: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
}

// ---------------------------------------------------------------------------
// Terminal states
// ---------------------------------------------------------------------------
const TERMINAL_STATUSES = new Set<ImportStatus>([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "PARTIAL",
]);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useImportProgress(
  importJobId: string | null,
  options: UseImportProgressOptions = {}
): UseImportProgressReturn {
  const {
    onProgress,
    onComplete,
    onError,
    maxRetries = 5,
    enabled = true,
  } = options;

  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const enabledRef = useRef(enabled);
  const stoppedRef = useRef(false);

  enabledRef.current = enabled;

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!importJobId || stoppedRef.current) return;

    const url = `/api/imports/${importJobId}/progress`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
      retriesRef.current = 0;
    };

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>;

        if (data.type === "timeout" || data.type === "error") {
          setError(String(data.message ?? "Stream error"));
          es.close();
          esRef.current = null;
          setIsConnected(false);
          return;
        }

        if (data.type === "progress") {
          const update: ImportProgress = {
            status: data.status as ImportStatus,
            progress: Number(data.progress),
            totalRows: Number(data.totalRows),
            processedRows: Number(data.processedRows),
            successRows: Number(data.successRows),
            failedRows: Number(data.failedRows),
            skippedRows: Number(data.skippedRows),
            duplicateRows: Number(data.duplicateRows),
            startedAt: (data.startedAt as string | null) ?? null,
            completedAt: (data.completedAt as string | null) ?? null,
          };

          setProgress(update);
          onProgress?.(update);

          if (TERMINAL_STATUSES.has(update.status)) {
            setIsComplete(true);
            onComplete?.(update);
            es.close();
            esRef.current = null;
            setIsConnected(false);
          }
        }
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = (event) => {
      setIsConnected(false);
      es.close();
      esRef.current = null;
      onError?.(event);

      // Attempt reconnect with exponential backoff
      if (retriesRef.current < maxRetries && !stoppedRef.current && enabledRef.current) {
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30_000);
        retriesRef.current++;

        setTimeout(() => {
          if (!stoppedRef.current) connect();
        }, delay);
      } else {
        setError("Connection to import progress stream failed");
      }
    };
  }, [importJobId, maxRetries, onProgress, onComplete, onError]);

  const start = useCallback(() => {
    stoppedRef.current = false;
    retriesRef.current = 0;
    if (esRef.current) {
      esRef.current.close();
    }
    connect();
  }, [connect]);

  useEffect(() => {
    if (!importJobId || !enabled) return;

    stoppedRef.current = false;
    connect();

    return () => {
      stop();
    };
  }, [importJobId, enabled, connect, stop]);

  return { progress, isConnected, isComplete, error, start, stop };
}
