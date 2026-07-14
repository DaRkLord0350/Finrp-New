// ============================================================
// FinRP — TBX Call Logging (Module 8)
//
// Wraps every TBX provider call so a TbxApiLog row is always
// written — endpoint, payload, response, headers, status,
// duration, retry count, who/what it was for. Mirrors lib/audit.ts's
// try/catch-swallow contract: a logging failure must never break
// the underlying verification call.
//
// `success` records whether the HTTP call itself succeeded, not
// whether the verification passed — a PAN that comes back invalid
// is still a successful API call with outcome "FAILED".
//
// Every payload is redacted (lib/tbx/redaction.ts) before it is
// persisted — never optional, never deferred.
// ============================================================

import type { Prisma } from "@prisma/client";
import { tbxLogRepository } from "@/lib/repositories/tbx-log.repository";
import { redact } from "./redaction";
import { TbxProviderError, type TbxResultBase } from "./types";

export interface TbxLogContext {
  apiName: string;
  organizationId?: string | null;
  userId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  backgroundJobId?: string | null;
}

async function logTbxCall(
  ctx: TbxLogContext,
  outcome: { success: boolean; requestPayload?: unknown; result?: TbxResultBase; error?: unknown }
): Promise<void> {
  try {
    const diag = outcome.result?.diagnostics;
    const providerError = outcome.error instanceof TbxProviderError ? outcome.error : null;

    await tbxLogRepository.create({
      organizationId: ctx.organizationId ?? null,
      userId: ctx.userId ?? null,
      apiName: ctx.apiName,
      endpoint: diag?.endpoint ?? null,
      httpMethod: diag?.httpMethod ?? null,
      requestPayload: redact(outcome.requestPayload ?? null) as Prisma.InputJsonValue,
      responsePayload: outcome.result ? (redact(outcome.result.raw) as Prisma.InputJsonValue) : undefined,
      responseHeaders: diag?.responseHeaders ? (redact(diag.responseHeaders) as Prisma.InputJsonValue) : undefined,
      statusCode: diag?.statusCode ?? providerError?.status ?? null,
      durationMs: diag?.durationMs ?? null,
      retryCount: diag?.retryCount ?? 0,
      success: outcome.success,
      errorMessage: outcome.error
        ? (outcome.error instanceof Error ? outcome.error.message : String(outcome.error)).slice(0, 2000)
        : null,
      subjectType: ctx.subjectType ?? null,
      subjectId: ctx.subjectId ?? null,
      backgroundJobId: ctx.backgroundJobId ?? null,
    });
  } catch (err) {
    // Logging failures must never break the underlying verification call.
    console.error("[tbx] Failed to write TbxApiLog:", err);
  }
}

/**
 * Call a TBX provider method and unconditionally log the outcome (success
 * or failure) as a TbxApiLog row. Re-throws provider errors after logging
 * so callers keep normal try/catch control flow.
 */
export async function withTbxLogging<TResult extends TbxResultBase>(
  ctx: TbxLogContext,
  requestPayload: unknown,
  fn: () => Promise<TResult>
): Promise<TResult> {
  try {
    const result = await fn();
    await logTbxCall(ctx, { success: true, requestPayload, result });
    return result;
  } catch (err) {
    await logTbxCall(ctx, { success: false, requestPayload, error: err });
    throw err;
  }
}
