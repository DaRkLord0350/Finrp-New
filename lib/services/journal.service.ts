// ============================================================
// Journal Service — Manual Journals + posting workflow
//
// Architecture: API → journalService → (prisma tx) → repositories
// Invariants:
//   - A journal must balance (Σdebit == Σcredit) before it can post.
//   - Posting is atomic: number assignment + status flip + account
//     balance recompute happen in a single transaction.
//   - Posted entries are immutable; correct them via void or reverse.
//   - Every mutation is audited and period-guarded (assertPostingAllowed).
// ============================================================

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { journalRepository } from "@/lib/repositories/journal.repository";
import { accountingService } from "@/lib/services/accounting.service";
import { createAuditLog } from "@/lib/audit";
import { generateNextJournalNumber } from "@/lib/generators/journal-number";
import { recomputeAccountBalances } from "@/lib/accounting/balances";
import { assertPostingAllowed, PeriodLockedError, resolveFiscalPeriod } from "@/lib/accounting/period";
import type { CreateJournalInput, UpdateJournalInput, ListJournalsQuery } from "@/lib/validators/journal";

class JournalError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = "JournalError";
  }
}
export { JournalError };

type Actor = { userId: string | null; canOverrideLock?: boolean };

const TOLERANCE = new Prisma.Decimal("0.005");

function computeTotals(lines: { type: "DEBIT" | "CREDIT"; amount: number }[]) {
  let totalDebit = new Prisma.Decimal(0);
  let totalCredit = new Prisma.Decimal(0);
  for (const l of lines) {
    if (l.type === "DEBIT") totalDebit = totalDebit.add(l.amount);
    else totalCredit = totalCredit.add(l.amount);
  }
  return { totalDebit, totalCredit };
}

/** Validate every referenced account is postable (exists, active, not a parent). */
async function validateAccounts(organizationId: string, lines: { accountId: string }[]) {
  const unique = Array.from(new Set(lines.map((l) => l.accountId)));
  await Promise.all(unique.map((id) => accountingService.validatePostingAccount(organizationId, id)));
}

function assertBalanced(totalDebit: Prisma.Decimal, totalCredit: Prisma.Decimal) {
  if (totalDebit.sub(totalCredit).abs().gt(TOLERANCE)) {
    throw new JournalError(
      `Journal is not balanced — debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}`,
      422
    );
  }
}

export const journalService = {
  // ── Reads ────────────────────────────────────────────────────────────────
  list(organizationId: string, params: ListJournalsQuery) {
    return journalRepository.list(organizationId, params);
  },

  async getById(organizationId: string, id: string) {
    const journal = await journalRepository.findById(organizationId, id);
    if (!journal) throw new JournalError("Journal entry not found", 404);
    return journal;
  },

  // ── Create (optionally post atomically) ────────────────────────────────────
  async create(organizationId: string, actor: Actor, input: CreateJournalInput) {
    await validateAccounts(organizationId, input.lines);
    const { totalDebit, totalCredit } = computeTotals(input.lines);
    assertBalanced(totalDebit, totalCredit);

    if (input.post) {
      await assertPostingAllowed(organizationId, input.entryDate, { canOverride: actor.canOverrideLock });
    }

    const fiscal = input.post
      ? await resolveFiscalPeriod(organizationId, input.entryDate)
      : { fiscalYearId: null, fiscalPeriodId: null };

    const created = await prisma.$transaction(async (tx) => {
      const journalNumber = input.post
        ? await generateNextJournalNumber(organizationId, { client: tx })
        : null;

      const entry = await tx.journalEntry.create({
        data: {
          organizationId,
          journalNumber,
          status: input.post ? "POSTED" : "DRAFT",
          journalType: "MANUAL",
          reference: input.reference ?? null,
          description: input.description ?? null,
          notes: input.notes ?? null,
          entryDate: input.entryDate,
          currency: input.currency,
          exchangeRate: new Prisma.Decimal(input.exchangeRate),
          totalDebit,
          totalCredit,
          createdById: actor.userId,
          postedById: input.post ? actor.userId : null,
          postedAt: input.post ? new Date() : null,
          fiscalYearId: fiscal.fiscalYearId,
          fiscalPeriodId: fiscal.fiscalPeriodId,
          lines: {
            create: input.lines.map((l, i) => ({
              accountId: l.accountId,
              type: l.type,
              amount: new Prisma.Decimal(l.amount),
              description: l.description ?? null,
              lineOrder: i,
            })),
          },
        },
        select: { id: true, journalNumber: true },
      });

      if (input.post) {
        await recomputeAccountBalances(tx, organizationId, input.lines.map((l) => l.accountId));
      }
      return entry;
    });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: input.post ? "POST" : "CREATE",
      entity: "journal_entry",
      entityId: created.id,
      description: input.post
        ? `Posted journal ${created.journalNumber}`
        : `Created draft journal`,
      newValue: { totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2), lines: input.lines.length },
    });

    return this.getById(organizationId, created.id);
  },

  // ── Update a draft ─────────────────────────────────────────────────────────
  async updateDraft(organizationId: string, actor: Actor, id: string, input: UpdateJournalInput) {
    const existing = await journalRepository.findById(organizationId, id);
    if (!existing) throw new JournalError("Journal entry not found", 404);
    if (existing.status !== "DRAFT") throw new JournalError("Only draft journals can be edited", 422);

    await validateAccounts(organizationId, input.lines);
    const { totalDebit, totalCredit } = computeTotals(input.lines);
    assertBalanced(totalDebit, totalCredit);

    await prisma.$transaction(async (tx) => {
      await tx.journalLine.deleteMany({ where: { journalEntryId: id } });
      await tx.journalEntry.update({
        where: { id },
        data: {
          reference: input.reference ?? null,
          description: input.description ?? null,
          notes: input.notes ?? null,
          entryDate: input.entryDate,
          currency: input.currency,
          exchangeRate: new Prisma.Decimal(input.exchangeRate),
          totalDebit,
          totalCredit,
          lines: {
            create: input.lines.map((l, i) => ({
              accountId: l.accountId,
              type: l.type,
              amount: new Prisma.Decimal(l.amount),
              description: l.description ?? null,
              lineOrder: i,
            })),
          },
        },
      });
    });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "journal_entry",
      entityId: id,
      description: `Updated draft journal`,
    });

    return this.getById(organizationId, id);
  },

  // ── Post an existing draft ──────────────────────────────────────────────────
  async post(organizationId: string, actor: Actor, id: string) {
    const existing = await journalRepository.findById(organizationId, id);
    if (!existing) throw new JournalError("Journal entry not found", 404);
    if (existing.status === "POSTED") throw new JournalError("Journal is already posted", 422);
    if (existing.status === "VOID") throw new JournalError("Voided journals cannot be posted", 422);

    const totalDebit = new Prisma.Decimal(existing.totalDebit);
    const totalCredit = new Prisma.Decimal(existing.totalCredit);
    assertBalanced(totalDebit, totalCredit);
    // Re-validate accounts are still postable at post time.
    await validateAccounts(organizationId, existing.lines.map((l) => ({ accountId: l.accountId })));
    await assertPostingAllowed(organizationId, existing.entryDate, { canOverride: actor.canOverrideLock });

    const fiscal = await resolveFiscalPeriod(organizationId, existing.entryDate);

    await prisma.$transaction(async (tx) => {
      const journalNumber = existing.journalNumber ?? (await generateNextJournalNumber(organizationId, { client: tx }));
      await tx.journalEntry.update({
        where: { id },
        data: {
          status: "POSTED",
          journalNumber,
          postedById: actor.userId,
          postedAt: new Date(),
          fiscalYearId: fiscal.fiscalYearId,
          fiscalPeriodId: fiscal.fiscalPeriodId,
        },
      });
      await recomputeAccountBalances(tx, organizationId, existing.lines.map((l) => l.accountId));
    });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "POST",
      entity: "journal_entry",
      entityId: id,
      description: `Posted journal ${existing.journalNumber ?? id}`,
    });

    return this.getById(organizationId, id);
  },

  // ── Void a posted entry (removes its ledger effect) ─────────────────────────
  async void(organizationId: string, actor: Actor, id: string) {
    const existing = await journalRepository.findById(organizationId, id);
    if (!existing) throw new JournalError("Journal entry not found", 404);
    if (existing.status !== "POSTED") throw new JournalError("Only posted journals can be voided", 422);
    if (existing.journalType === "SYSTEM") throw new JournalError("System-generated journals cannot be voided here", 422);
    await assertPostingAllowed(organizationId, existing.entryDate, { canOverride: actor.canOverrideLock });

    await prisma.$transaction(async (tx) => {
      await tx.journalEntry.update({ where: { id }, data: { status: "VOID" } });
      await recomputeAccountBalances(tx, organizationId, existing.lines.map((l) => l.accountId));
    });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "UPDATE",
      entity: "journal_entry",
      entityId: id,
      description: `Voided journal ${existing.journalNumber ?? id}`,
    });

    return this.getById(organizationId, id);
  },

  // ── Reverse a posted entry (new mirror entry; original is preserved) ─────────
  async reverse(organizationId: string, actor: Actor, id: string, reversalDate?: Date) {
    const existing = await journalRepository.findById(organizationId, id);
    if (!existing) throw new JournalError("Journal entry not found", 404);
    if (existing.status !== "POSTED") throw new JournalError("Only posted journals can be reversed", 422);

    const date = reversalDate ?? new Date();
    await assertPostingAllowed(organizationId, date, { canOverride: actor.canOverrideLock });

    const reversal = await prisma.$transaction(async (tx) => {
      const journalNumber = await generateNextJournalNumber(organizationId, { client: tx });
      const entry = await tx.journalEntry.create({
        data: {
          organizationId,
          journalNumber,
          status: "POSTED",
          journalType: "ADJUSTMENT",
          reference: existing.journalNumber ? `REV-${existing.journalNumber}` : `REV-${existing.id.slice(-6)}`,
          description: `Reversal of ${existing.journalNumber ?? existing.id}`,
          entryDate: date,
          currency: existing.currency,
          exchangeRate: new Prisma.Decimal(existing.exchangeRate),
          totalDebit: new Prisma.Decimal(existing.totalCredit),
          totalCredit: new Prisma.Decimal(existing.totalDebit),
          createdById: actor.userId,
          postedById: actor.userId,
          postedAt: new Date(),
          reversalOfId: existing.id,
          lines: {
            create: existing.lines.map((l, i) => ({
              accountId: l.accountId,
              type: l.type === "DEBIT" ? "CREDIT" : "DEBIT",
              amount: new Prisma.Decimal(l.amount),
              description: `Reversal: ${l.description ?? ""}`.trim(),
              lineOrder: i,
            })),
          },
        },
        select: { id: true, journalNumber: true },
      });
      await recomputeAccountBalances(tx, organizationId, existing.lines.map((l) => l.accountId));
      return entry;
    });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "REVERSE",
      entity: "journal_entry",
      entityId: existing.id,
      description: `Reversed journal ${existing.journalNumber ?? existing.id} → ${reversal.journalNumber}`,
    });

    return this.getById(organizationId, reversal.id);
  },

  // ── Delete a draft (soft delete) ────────────────────────────────────────────
  async deleteDraft(organizationId: string, actor: Actor, id: string) {
    const existing = await journalRepository.findById(organizationId, id);
    if (!existing) throw new JournalError("Journal entry not found", 404);
    if (existing.status !== "DRAFT") throw new JournalError("Only draft journals can be deleted", 422);

    await prisma.journalEntry.update({ where: { id }, data: { deletedAt: new Date() } });

    await createAuditLog({
      organizationId,
      userId: actor.userId ?? undefined,
      action: "DELETE",
      entity: "journal_entry",
      entityId: id,
      description: `Deleted draft journal`,
    });
  },
};

// Re-export so API routes can map period-lock errors to their HTTP status.
export { PeriodLockedError };
