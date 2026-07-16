// ============================================================
// lib/verification/ifsc/types.ts
//
// IFSC lookup against Razorpay's free, unauthenticated public API
// (https://ifsc.razorpay.com/<CODE>) — no vendor contract needed, so
// unlike Credit Bureau / negative-media / identity-document this is
// NOT behind the Provider Pattern's "endpoint not bound" honesty gate.
// It's genuinely implemented end-to-end.
// ============================================================

export interface IfscLookupResult {
  ifsc: string;
  bankName: string;
  bankCode: string;
  branch: string;
  address: string;
  city: string;
  district: string;
  state: string;
  contact: string | null;
  micr: string | null;
  upi: boolean;
  rtgs: boolean;
  neft: boolean;
  imps: boolean;
}

export class IfscFormatError extends Error {
  readonly status = 400;
  constructor(code: string) {
    super(`"${code}" is not a valid 11-character IFSC code (4 letters + 0 + 6 alphanumeric)`);
    this.name = "IfscFormatError";
  }
}

export class IfscNotFoundError extends Error {
  readonly status = 404;
  constructor(code: string) {
    super(`No branch found for IFSC code "${code}"`);
    this.name = "IfscNotFoundError";
  }
}

export class IfscLookupError extends Error {
  readonly status = 502;
  constructor(message: string) {
    super(message);
    this.name = "IfscLookupError";
  }
}
