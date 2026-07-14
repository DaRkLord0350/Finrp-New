// ============================================================
// lib/validators/bank-verification.ts
// Zod schema for Module 6 — triggering TBX verification on an
// existing BankAccount.
// ============================================================

import { z } from "zod";

export const VerifyBankAccountSchema = z.object({
  method: z.enum(["PENNY_DROP", "PENNILESS_BAV"]),
});
export type VerifyBankAccountRequestInput = z.infer<typeof VerifyBankAccountSchema>;
