// ============================================================
// FinRP Banking OS — Structured Logger
// Consistent single-line JSON context logs for banking flows so
// provider calls, webhook processing, and sync runs are greppable
// by scope in production log aggregation.
//
//   const log = createBankingLogger("setu.provider");
//   log.info("consent created", { consentId, organizationId });
//   → [banking:setu.provider] consent created {"consentId":...}
// ============================================================

type LogContext = Record<string, unknown>;

export interface BankingLogger {
  debug: (message: string, ctx?: LogContext) => void;
  info: (message: string, ctx?: LogContext) => void;
  warn: (message: string, ctx?: LogContext) => void;
  error: (message: string, ctx?: LogContext) => void;
}

const SENSITIVE_KEYS = /secret|token|password|authorization|signature|vua/i;

/** Drop obviously sensitive values so they never reach the logs. */
function sanitize(ctx: LogContext): LogContext {
  const out: LogContext = {};
  for (const [key, value] of Object.entries(ctx)) {
    out[key] = SENSITIVE_KEYS.test(key) ? "[redacted]" : value;
  }
  return out;
}

function emit(
  level: "debug" | "info" | "warn" | "error",
  scope: string,
  message: string,
  ctx?: LogContext
) {
  const line = `[banking:${scope}] ${message}`;
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

export function createBankingLogger(scope: string): BankingLogger {
  return {
    debug: (message, ctx) => emit("debug", scope, message, ctx),
    info: (message, ctx) => emit("info", scope, message, ctx),
    warn: (message, ctx) => emit("warn", scope, message, ctx),
    error: (message, ctx) => emit("error", scope, message, ctx),
  };
}
