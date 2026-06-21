// ============================================================
// lib/tax/filing/provider.ts
//
// Provider-agnostic filing interface. Business logic depends only on
// this contract; concrete adapters (mock, gstn-standard, future GSPs)
// implement it. Swapping providers is an env change — no code change.
// ============================================================

export class FilingProviderError extends Error {
  constructor(
    message: string,
    readonly code: string = "PROVIDER_ERROR",
    readonly retryable = false
  ) {
    super(message);
    this.name = "FilingProviderError";
  }
}

export interface ProviderAuthContext {
  gstin: string;
  username?: string;
}

export interface SaveReturnArgs {
  gstin: string;
  returnType: string; // "GSTR1" | "GSTR3B"
  period: string; // MMYYYY
  payload: unknown; // government-compatible JSON
}

export interface SaveReturnResult {
  reference: string;
  raw?: unknown;
}

export interface SubmitReturnResult {
  reference?: string;
  status: string;
  raw?: unknown;
}

export interface FileReturnArgs extends SaveReturnArgs {
  /** EVC OTP or DSC signature blob, depending on signing flow. */
  signature?: string;
  signatureType?: "EVC" | "DSC";
}

export interface FileReturnResult {
  arn?: string;
  ackNo?: string;
  status: string;
  raw?: unknown;
}

export interface StatusArgs {
  gstin: string;
  returnType: string;
  period: string;
  reference?: string;
}

export interface StatusResult {
  status: string;
  arn?: string;
  raw?: unknown;
}

export interface Fetch2BArgs {
  gstin: string;
  period: string; // MMYYYY
}

export interface Gstr2bRow {
  supplierGstin?: string;
  supplierName?: string;
  invoiceNumber: string;
  invoiceDate?: string;
  invoiceValue?: number;
  taxableValue?: number;
  igst?: number;
  cgst?: number;
  sgst?: number;
  cess?: number;
  itcAvailable?: boolean;
}

export interface Fetch2BResult {
  records: Gstr2bRow[];
  raw?: unknown;
}

export interface FilingProvider {
  readonly name: string;
  /** True when this adapter talks to a real government/GSP endpoint. */
  readonly isLive: boolean;
  authenticate(ctx: ProviderAuthContext): Promise<{ token: string }>;
  saveReturn(args: SaveReturnArgs): Promise<SaveReturnResult>;
  submitReturn(args: SaveReturnArgs): Promise<SubmitReturnResult>;
  fileReturn(args: FileReturnArgs): Promise<FileReturnResult>;
  fetchStatus(args: StatusArgs): Promise<StatusResult>;
  fetch2B(args: Fetch2BArgs): Promise<Fetch2BResult>;
  /** Lightweight liveness probe for the admin dashboard. */
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
}
