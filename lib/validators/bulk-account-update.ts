// ============================================================
// Bulk Account Update — Zod Validators
// ============================================================

import { z } from "zod";
import { BULK_SCOPE_KEYS } from "@/lib/accounting/workers/bulk-account-update.worker";

export const CreateBulkUpdateSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  scopes: z.array(z.enum(BULK_SCOPE_KEYS as [string, ...string[]])).min(1, "Select at least one scope"),
});

export type CreateBulkUpdateInput = z.infer<typeof CreateBulkUpdateSchema>;
