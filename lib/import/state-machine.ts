// ============================================================
// FinRP — Import State Machine
// Strict FSM enforcing legal status transitions for ImportJob.
// Every import must end in COMPLETED, FAILED, or CANCELLED.
// Any other terminal state (PARTIAL) is treated as final.
// ============================================================

export type ImportStatusStr =
  | "PENDING"
  | "MAPPING"
  | "QUEUED"
  | "VALIDATING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "PARTIAL";

// All legal transitions. Every state must be listed.
const LEGAL_TRANSITIONS: Record<ImportStatusStr, ImportStatusStr[]> = {
  // PENDING is a legacy intermediate state — allow escape to MAPPING or forward
  PENDING: ["MAPPING", "QUEUED", "FAILED", "CANCELLED"],

  // MAPPING = user is configuring column mapping in the UI
  MAPPING: ["QUEUED", "PROCESSING", "FAILED", "CANCELLED"],
  //        ↑ normal  ↑ worker self-heal if DB update missed

  // QUEUED = BullMQ job created, waiting for worker pickup
  QUEUED: ["PROCESSING", "FAILED", "CANCELLED"],

  // VALIDATING = optional pre-processing validation step
  VALIDATING: ["PROCESSING", "FAILED", "CANCELLED"],

  // PROCESSING = worker is actively processing rows
  PROCESSING: ["COMPLETED", "FAILED", "CANCELLED", "PARTIAL"],

  // Terminal states — retry creates a new job or re-submits mapping
  COMPLETED:  [],
  PARTIAL:    [],
  FAILED:     [],
  CANCELLED:  [],
};

export const TERMINAL_IMPORT_STATUSES: ReadonlySet<ImportStatusStr> = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "PARTIAL",
]);

export const PRE_QUEUE_STATUSES: ReadonlySet<ImportStatusStr> = new Set([
  "PENDING",
  "MAPPING",
]);

export const IN_FLIGHT_STATUSES: ReadonlySet<ImportStatusStr> = new Set([
  "QUEUED",
  "PROCESSING",
  "VALIDATING",
]);

export function isTerminalImportStatus(status: ImportStatusStr): boolean {
  return TERMINAL_IMPORT_STATUSES.has(status);
}

export function isInFlightImportStatus(status: ImportStatusStr): boolean {
  return IN_FLIGHT_STATUSES.has(status);
}

/**
 * Throws a descriptive error if `current → next` is not a legal transition.
 * Call this before every status update in the worker and mapping route.
 */
export function assertLegalImportTransition(
  current: ImportStatusStr,
  next: ImportStatusStr
): void {
  const allowed = LEGAL_TRANSITIONS[current];
  if (!allowed) {
    throw new Error(`Unknown import status: "${current}"`);
  }
  if (!allowed.includes(next)) {
    const allowedStr = allowed.length > 0 ? allowed.join(", ") : "none — terminal state";
    throw new Error(
      `Illegal import status transition: ${current} → ${next}. ` +
      `Valid transitions from ${current}: [${allowedStr}].`
    );
  }
}

export { LEGAL_TRANSITIONS as IMPORT_STATE_TRANSITIONS };
