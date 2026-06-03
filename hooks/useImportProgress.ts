// ============================================================
// FinRP — useImportProgress
// SSE-based real-time import progress hook.
// Handles: progress, terminal states, stuck detection, reconnect.
// ============================================================

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportStatus =
  | "PENDING"
  | "QUEUED"
  | "MAPPING"
  | "VALIDATING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "PARTIAL";

export interface ImportProgress {
  status:          ImportStatus;
  progress:        number;
  totalRows:       number;
  processedRows:   number;
  successRows:     number;
  failedRows:      number;
  skippedRows:     number;
  duplicateRows:   number;
  startedAt:       string | null;
  completedAt:     string | null;
  queuedAt:        string | null;
  failedAt:        string | null;
  lastHeartbeatAt: string | null;
  updatedAt:       string | null;
  bullmqJobId:     string | null;
  error:           string | null;
}

export interface StuckEvent {
  reason:     string;
  message:    string;
  status:     string;
  stuckForMs: number;
  action:     string;
}

export interface UseImportProgressOptions {
  onProgress?:  (progress: ImportProgress) => void;
  onComplete?:  (progress: ImportProgress) => void;
  onError?:     (error: Event) => void;
  onStuck?:     (event: StuckEvent) => void;
  maxRetries?:  number;
  enabled?:     boolean;
}

export interface UseImportProgressReturn {
  progress:    ImportProgress | null;
  isConnected: boolean;
  isComplete:  boolean;
  isStuck:     boolean;
  stuckEvent:  StuckEvent | null;
  error:       string | null;
  start:       () => void;
  stop:        () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set<ImportStatus>([
  "COMPLETED", "FAILED", "CANCELLED", "PARTIAL",
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
    onStuck,
    maxRetries = 5,
    enabled    = true,
  } = options;

  const [progress,    setProgress]    = useState<ImportProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete,  setIsComplete]  = useState(false);
  const [isStuck,     setIsStuck]     = useState(false);
  const [stuckEvent,  setStuckEvent]  = useState<StuckEvent | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  const esRef        = useRef<EventSource | null>(null);
  const retriesRef   = useRef(0);
  const enabledRef   = useRef(enabled);
  const stoppedRef   = useRef(false);

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
    const es  = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
      retriesRef.current = 0;
    };

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>;

        // ── Stuck / timeout / error from server ──
        if (data.type === "stuck") {
          const evt: StuckEvent = {
            reason:     String(data.reason   ?? "Unknown reason"),
            message:    String(data.message  ?? "Import appears stuck"),
            status:     String(data.status   ?? "UNKNOWN"),
            stuckForMs: Number(data.stuckForMs ?? 0),
            action:     String(data.action   ?? ""),
          };
          setIsStuck(true);
          setStuckEvent(evt);
          setError(evt.message);
          onStuck?.(evt);
          es.close();
          esRef.current = null;
          setIsConnected(false);
          return;
        }

        if (data.type === "timeout") {
          setError(String(data.message ?? "Stream timed out. Reload to reconnect."));
          es.close();
          esRef.current = null;
          setIsConnected(false);
          return;
        }

        if (data.type === "error") {
          setError(String(data.message ?? "Stream error"));
          es.close();
          esRef.current = null;
          setIsConnected(false);
          return;
        }

        // ── Progress update ──
        if (data.type === "progress") {
          const update: ImportProgress = {
            status:          data.status as ImportStatus,
            progress:        Number(data.progress),
            totalRows:       Number(data.totalRows),
            processedRows:   Number(data.processedRows),
            successRows:     Number(data.successRows),
            failedRows:      Number(data.failedRows),
            skippedRows:     Number(data.skippedRows),
            duplicateRows:   Number(data.duplicateRows),
            startedAt:       (data.startedAt       as string | null) ?? null,
            completedAt:     (data.completedAt     as string | null) ?? null,
            queuedAt:        (data.queuedAt        as string | null) ?? null,
            failedAt:        (data.failedAt        as string | null) ?? null,
            lastHeartbeatAt: (data.lastHeartbeatAt as string | null) ?? null,
            updatedAt:       (data.updatedAt       as string | null) ?? null,
            bullmqJobId:     (data.bullmqJobId     as string | null) ?? null,
            error:           (data.error           as string | null) ?? null,
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

      if (retriesRef.current < maxRetries && !stoppedRef.current && enabledRef.current) {
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30_000);
        retriesRef.current++;
        setTimeout(() => {
          if (!stoppedRef.current) connect();
        }, delay);
      } else {
        setError("Connection to progress stream failed. The import may still be running.");
      }
    };
  }, [importJobId, maxRetries, onProgress, onComplete, onError, onStuck]);

  const start = useCallback(() => {
    stoppedRef.current = false;
    retriesRef.current = 0;
    setIsStuck(false);
    setStuckEvent(null);
    setError(null);
    if (esRef.current) {
      esRef.current.close();
    }
    connect();
  }, [connect]);

  useEffect(() => {
    if (!importJobId || !enabled) return;

    stoppedRef.current = false;
    connect();

    return () => { stop(); };
  }, [importJobId, enabled, connect, stop]);

  return {
    progress,
    isConnected,
    isComplete,
    isStuck,
    stuckEvent,
    error,
    start,
    stop,
  };
}
