// ============================================================
// Budgets — Zod Validators
// ============================================================

import { z } from "zod";

export const CreateBudgetSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  fiscalYearId: z.string().min(1, "Fiscal year is required"),
  granularity: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).default("MONTHLY"),
});

export const UpdateBudgetSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
});

export const SetBudgetLinesSchema = z.object({
  lines: z
    .array(
      z.object({
        accountId: z.string().min(1),
        periodIndex: z.number().int().min(0).max(11),
        amount: z.coerce.number().finite(),
      })
    )
    .max(5000),
});

export type CreateBudgetInput = z.infer<typeof CreateBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof UpdateBudgetSchema>;
export type SetBudgetLinesInput = z.infer<typeof SetBudgetLinesSchema>;
