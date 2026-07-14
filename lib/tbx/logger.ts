// ============================================================
// FinRP — TBX Structured Logger
// Mirrors lib/banking/logger.ts — single-line JSON context logs,
// scoped by module, with sensitive keys redacted before they ever
// reach process stdout/stderr.
// ============================================================

type LogContext = Record<string, unknown>;

export interface TbxLogger {
  debug: (message: string, ctx?: LogContext) => void;
  info: (message: string, ctx?: LogContext) => void;
  warn: (message: string, ctx?: LogContext) => void;
  error: (message: string, ctx?: LogContext) => void;
}

const SENSITIVE_KEYS = /secret|token|password|authorization|signature|aadhaar|otp|accountnumber/i;

function sanitize(ctx: LogContext): LogContext {
  const out: LogContext = {};
  for (const [key, value] of Object.entries(ctx)) {
    out[key] = SENSITIVE_KEYS.test(key) ? "[redacted]" : value;
  }
  return out;
}

function emit(level: "debug" | "info" | "warn" | "error", scope: string, message: string, ctx?: LogContext) {
  const line = `[tbx:${scope}] ${message}`;
  const payload = ctx ? JSON.stringify(sanitize(ctx)) : "";
  switch (level) {
    case "debug":
      if (process.env.NODE_ENV !== "production") console.debug(line, payload);
      break;
    case "info":
      console.log(line, payload);
      break;
    case "warn":
      console.warn(line, payload);
      break;
    case "error":
      console.error(line, payload);
      break;
  }
}

export function createTbxLogger(scope: string): TbxLogger {
  return {
    debug: (message, ctx) => emit("debug", scope, message, ctx),
    info: (message, ctx) => emit("info", scope, message, ctx),
    warn: (message, ctx) => emit("warn", scope, message, ctx),
    error: (message, ctx) => emit("error", scope, message, ctx),
  };
}
