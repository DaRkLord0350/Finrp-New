// ============================================================
// Fiscal Years, Periods & Accounting Settings — Zod Validators
// ============================================================

import { z } from "zod";

export const CreateFiscalYearSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(60),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((d) => d.endDate > d.startDate, { message: "End date must be after start date", path: ["endDate"] });

export const SetPeriodStatusSchema = z.object({
  status: z.enum(["OPEN", "CLOSED", "LOCKED"]),
});

export const UpdateAccountingSettingsSchema = z.object({
  baseCurrency: z.string().trim().length(3).optional(),
  lockDate: z.coerce.date().nullable().optional(),
  lockReason: z.string().trim().max(255).nullable().optional(),
  retainedEarningsAccountId: z.string().min(1).nullable().optional(),
  forexGainLossAccountId: z.string().min(1).nullable().optional(),
  roundingAccountId: z.string().min(1).nullable().optional(),
});

export type CreateFiscalYearInput = z.infer<typeof CreateFiscalYearSchema>;
export type UpdateAccountingSettingsInput = z.infer<typeof UpdateAccountingSettingsSchema>;
