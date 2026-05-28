// ============================================================
// FinRP — Abstract Base Connector
// All connectors must extend this class and implement the
// declared abstract methods. Shared retry + logging logic
// lives here so connectors stay lean.
// ============================================================

import type {
  ConnectionTestResult,
  ExtractionResult,
  RawCustomer,
  RawInvoice,
  RawProduct,
  RawEmployee,
  SyncCursor,
  SyncStats,
  ValidationResult,
  MappingRule,
} from "./types";

// ---------------------------------------------------------------------------
// Connector interface (contract every implementation must satisfy)
// ---------------------------------------------------------------------------
export interface IConnector {
  readonly type: string;
  readonly organizationId: string;

  testConnection(): Promise<ConnectionTestResult>;

  fetchCustomers(cursor?: SyncCursor): Promise<ExtractionResult<RawCustomer>>;
  fetchInvoices(cursor?: SyncCursor): Promise<ExtractionResult<RawInvoice>>;
  fetchProducts(cursor?: SyncCursor): Promise<ExtractionResult<RawProduct>>;
  fetchEmployees(cursor?: SyncCursor): Promise<ExtractionResult<RawEmployee>>;

  transform<TRaw extends Record<string, unknown>, TMapped extends Record<string, unknown>>(raw: TRaw, mappings: MappingRule[]): TMapped;
  validate(data: Record<string, unknown>, entity: string): ValidationResult;
  sync(entity: string, cursor?: SyncCursor): Promise<SyncStats>;
}

// ---------------------------------------------------------------------------
// Base implementation with shared utilities
// ---------------------------------------------------------------------------
export abstract class BaseConnector implements IConnector {
  abstract readonly type: string;

  constructor(
    readonly organizationId: string,
    protected readonly config: Record<string, unknown>
  ) {}

  // ---------------------------------------------------------------------------
  // To be implemented by each connector
  // ---------------------------------------------------------------------------
  abstract testConnection(): Promise<ConnectionTestResult>;
  abstract fetchCustomers(cursor?: SyncCursor): Promise<ExtractionResult<RawCustomer>>;
  abstract fetchInvoices(cursor?: SyncCursor): Promise<ExtractionResult<RawInvoice>>;
  abstract fetchProducts(cursor?: SyncCursor): Promise<ExtractionResult<RawProduct>>;
  abstract fetchEmployees(cursor?: SyncCursor): Promise<ExtractionResult<RawEmployee>>;
  abstract validate(data: Record<string, unknown>, entity: string): ValidationResult;
  abstract sync(entity: string, cursor?: SyncCursor): Promise<SyncStats>;

  // ---------------------------------------------------------------------------
  // Generic field mapper — applies MappingRule[] to a raw record
  // ---------------------------------------------------------------------------
  transform<TRaw extends Record<string, unknown>, TMapped extends Record<string, unknown>>(
    raw: TRaw,
    mappings: MappingRule[]
  ): TMapped {
    const result: Record<string, unknown> = {};

    for (const rule of mappings) {
      let value: unknown = raw[rule.sourceField];

      // Skip if empty and told to
      if ((value === undefined || value === null || value === "") && rule.skipIfEmpty) {
        continue;
      }

      // Apply default
      if ((value === undefined || value === null || value === "") && rule.defaultValue !== undefined) {
        value = rule.defaultValue;
      }

      // Apply transforms in order
      for (const t of rule.transforms) {
        value = applyTransform(value, t);
      }

      // Set in result using dot-notation path
      setNestedValue(result, rule.targetField, value);
    }

    return result as TMapped;
  }

  // ---------------------------------------------------------------------------
  // Retry helper — wraps an async fn with exponential backoff
  // ---------------------------------------------------------------------------
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    baseDelayMs = 1000
  ): Promise<T> {
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt === maxAttempts) break;

        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(
          `[${this.type}] Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. Retrying in ${delay}ms...`
        );
        await sleep(delay);
      }
    }

    throw lastError;
  }

  // ---------------------------------------------------------------------------
  // Rate-limit helper — wraps a fn to wait between calls
  // ---------------------------------------------------------------------------
  protected async withRateLimit<T>(
    fn: () => Promise<T>,
    minIntervalMs = 200
  ): Promise<T> {
    const start = Date.now();
    const result = await fn();
    const elapsed = Date.now() - start;

    if (elapsed < minIntervalMs) {
      await sleep(minIntervalMs - elapsed);
    }

    return result;
  }

  protected log(level: "info" | "warn" | "error", message: string, meta?: unknown): void {
    const prefix = `[${this.type}][${this.organizationId.slice(-6)}]`;
    if (level === "error") {
      console.error(`${prefix} ${message}`, meta ?? "");
    } else if (level === "warn") {
      console.warn(`${prefix} ${message}`, meta ?? "");
    } else {
      console.log(`${prefix} ${message}`, meta ?? "");
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyTransform(value: unknown, t: { type: string; [key: string]: unknown }): unknown {
  if (value === null || value === undefined) return value;

  const str = String(value);

  switch (t.type) {
    case "trim":
      return str.trim();
    case "uppercase":
      return str.toUpperCase();
    case "lowercase":
      return str.toLowerCase();
    case "numberParse":
      return parseFloat(str.replace(/,/g, "")) || 0;
    case "booleanParse":
      return ["true", "yes", "1", "y"].includes(str.toLowerCase());
    case "gstNormalize":
      return str.replace(/\s+/g, "").toUpperCase();
    case "currencyCode":
      return str.toUpperCase().slice(0, 3);
    case "dateFormat": {
      // Attempt to parse and return ISO string
      const d = new Date(str);
      return isNaN(d.getTime()) ? str : d.toISOString();
    }
    case "lookup": {
      const map = t.map as Record<string, string>;
      return map[str] ?? map["_default"] ?? str;
    }
    case "split": {
      const separator = t.separator as string;
      const index = t.index as number;
      return str.split(separator)[index]?.trim() ?? str;
    }
    case "regex": {
      const pattern = new RegExp(t.pattern as string, "g");
      return str.replace(pattern, t.replacement as string);
    }
    case "constant":
      return t.value;
    default:
      return value;
  }
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}
