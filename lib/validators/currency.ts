// ============================================================
// Currency — Zod Validators
// ============================================================

import { z } from "zod";

export const UpsertRateSchema = z.object({
  baseCurrency: z.string().trim().length(3),
  targetCurrency: z.string().trim().length(3),
  rate: z.coerce.number().positive(),
  asOfDate: z.coerce.date(),
  source: z.string().trim().max(60).optional().nullable(),
});

export const RevaluationSchema = z.object({
  asOfDate: z.coerce.date(),
});

export type UpsertRateInput = z.infer<typeof UpsertRateSchema>;
