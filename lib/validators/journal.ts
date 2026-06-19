// ============================================================
// Manual Journals — Zod Validators
// Enforces the core double-entry rule: total debits == total credits.
// ============================================================

import { z } from "zod";

export const JOURNAL_STATUSES = ["DRAFT", "POSTED", "VOID"] as const;
export const JOURNAL_TYPES = ["MANUAL", "SYSTEM", "OPENING", "CLOSING", "FOREX", "ADJUSTMENT"] as const;

export const EntryTypeEnum = z.enum(["DEBIT", "CREDIT"]);

const amount = z.coerce
  .number()
  .finite("Amount must be a number")
  .gt(0, "Amount must be greater than zero");

export const JournalLineInputSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  type: EntryTypeEnum,
  amount,
  description: z.string().trim().max(255).optional().nullable(),
});

// Tolerance for floating-point comparison of the debit/credit totals.
const BALANCE_TOLERANCE = 0.005;

function balancedRefinement(
  data: { lines: { type: "DEBIT" | "CREDIT"; amount: number }[] },
  ctx: z.RefinementCtx
) {
  const debits = data.lines.filter((l) => l.type === "DEBIT").reduce((s, l) => s + l.amount, 0);
  const credits = data.lines.filter((l) => l.type === "CREDIT").reduce((s, l) => s + l.amount, 0);

  if (!data.lines.some((l) => l.type === "DEBIT") || !data.lines.some((l) => l.type === "CREDIT")) {
    ctx.addIssue({
      code: "custom",
      path: ["lines"],
      message: "A journal must have at least one debit and one credit line",
    });
    return;
  }
  if (Math.abs(debits - credits) > BALANCE_TOLERANCE) {
    ctx.addIssue({
      code: "custom",
      path: ["lines"],
      message: `Total debits (${debits.toFixed(2)}) must equal total credits (${credits.toFixed(2)})`,
    });
  }
}

export const CreateJournalSchema = z
  .object({
    entryDate: z.coerce.date(),
    reference: z.string().trim().max(120).optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    currency: z.string().trim().length(3).optional().default("INR"),
    exchangeRate: z.coerce.number().positive().optional().default(1),
    lines: z.array(JournalLineInputSchema).min(2, "A journal needs at least two lines"),
    // When true, the entry is created and immediately posted.
    post: z.boolean().optional().default(false),
  })
  .superRefine(balancedRefinement);

export const UpdateJournalSchema = z
  .object({
    entryDate: z.coerce.date(),
    reference: z.string().trim().max(120).optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    currency: z.string().trim().length(3).optional().default("INR"),
    exchangeRate: z.coerce.number().positive().optional().default(1),
    lines: z.array(JournalLineInputSchema).min(2, "A journal needs at least two lines"),
  })
  .superRefine(balancedRefinement);

export const ListJournalsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(JOURNAL_STATUSES).optional(),
  journalType: z.enum(JOURNAL_TYPES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(["entryDate", "journalNumber", "createdAt", "totalDebit"]).default("entryDate"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type JournalLineInput = z.infer<typeof JournalLineInputSchema>;
export type CreateJournalInput = z.infer<typeof CreateJournalSchema>;
export type UpdateJournalInput = z.infer<typeof UpdateJournalSchema>;
export type ListJournalsQuery = z.infer<typeof ListJournalsQuerySchema>;
