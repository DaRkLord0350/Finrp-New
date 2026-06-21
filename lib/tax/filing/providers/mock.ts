// ============================================================
// lib/tax/filing/providers/mock.ts
//
// Deterministic sandbox provider. Generates plausible references/ARNs
// from a hash of the request so flows are testable end-to-end without
// any GSP credentials. NEVER reports itself as live.
// ============================================================

import { createHash } from "crypto";
import type {
  FilingProvider,
  Fetch2BArgs,
  Fetch2BResult,
  FileReturnArgs,
  FileReturnResult,
  ProviderAuthContext,
  SaveReturnArgs,
  SaveReturnResult,
  StatusArgs,
  StatusResult,
  SubmitReturnResult,
} from "../provider";

function shortHash(input: string, len = 12): string {
  return createHash("sha256").update(input).digest("hex").slice(0, len).toUpperCase();
}

export class MockFilingProvider implements FilingProvider {
  readonly name = "mock";
  readonly isLive = false;

  async authenticate(ctx: ProviderAuthContext): Promise<{ token: string }> {
    return { token: `MOCK-${shortHash(ctx.gstin)}` };
  }

  async saveReturn(args: SaveReturnArgs): Promise<SaveReturnResult> {
    return {
      reference: `SAVE-${shortHash(`${args.gstin}${args.returnType}${args.period}`)}`,
      raw: { status_cd: "1", note: "mock save" },
    };
  }

  async submitReturn(args: SaveReturnArgs): Promise<SubmitReturnResult> {
    return {
      reference: `SUB-${shortHash(`${args.gstin}${args.period}`)}`,
      status: "SUBMITTED",
      raw: { status_cd: "1" },
    };
  }

  async fileReturn(args: FileReturnArgs): Promise<FileReturnResult> {
    const state = args.gstin?.slice(0, 2) ?? "00";
    const arn = `AA${state}${shortHash(`${args.gstin}${args.period}${Date.now()}`, 13)}`;
    return {
      arn,
      ackNo: shortHash(arn, 16),
      status: "FILED",
      raw: { status_cd: "1", arn },
    };
  }

  async fetchStatus(args: StatusArgs): Promise<StatusResult> {
    return { status: "FILED", arn: args.reference, raw: { status_cd: "1" } };
  }

  async fetch2B(_args: Fetch2BArgs): Promise<Fetch2BResult> {
    // The mock provider returns no auto-fetched 2B rows; tests/users
    // import a sample 2B file instead.
    return { records: [], raw: { note: "mock provider has no 2B feed; import a file" } };
  }

  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    return { ok: true, detail: "Mock provider (no live submission)" };
  }
}
