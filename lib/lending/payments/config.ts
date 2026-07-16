// ============================================================
// lib/lending/payments/config.ts
// Fail-fast env reader — mirrors lib/tbx/config.ts exactly.
// ============================================================

export interface LoanPaymentConfig {
  baseUrl: string;
  clientId: string;
  apiKey: string;
}

export class LoanPaymentConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `Loan payment gateway is not configured — missing env var(s): ${missing.join(", ")}. ` +
        `Set LOAN_PAYMENT_MOCK_MODE=true for development instead.`
    );
    this.name = "LoanPaymentConfigError";
  }
}

export function isLoanPaymentMockMode(): boolean {
  return process.env.LOAN_PAYMENT_MOCK_MODE === "true";
}

export function getLoanPaymentConfig(): LoanPaymentConfig {
  const baseUrl = process.env.LOAN_PAYMENT_BASE_URL;
  const clientId = process.env.LOAN_PAYMENT_CLIENT_ID;
  const apiKey = process.env.LOAN_PAYMENT_API_KEY;

  const missing: string[] = [];
  if (!baseUrl) missing.push("LOAN_PAYMENT_BASE_URL");
  if (!clientId) missing.push("LOAN_PAYMENT_CLIENT_ID");
  if (!apiKey) missing.push("LOAN_PAYMENT_API_KEY");
  if (missing.length > 0) throw new LoanPaymentConfigError(missing);

  return { baseUrl: baseUrl!, clientId: clientId!, apiKey: apiKey! };
}
