// ============================================================
// Currency Service
//   - org exchange-rate book (CRUD; rate = base units per 1 target unit)
//   - FX revaluation: revalue foreign-currency exposure (POSTED journal
//     entries whose currency != base) at a new as-of rate and post the
//     unrealized gain/loss against the Forex Gain/Loss account.
// ============================================================

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { generateNextJournalNumber } from "@/lib/generators/journal-number";
import { recomputeAccountBalances } from "@/lib/accounting/balances";
import { getAccountingSettings } from "@/lib/accounting/period";

class CurrencyError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = "CurrencyError";
  }
}
export { CurrencyError };

type Actor = { userId: string | null };

const ZERO = new Prisma.Decimal(0);
const CENT = new Prisma.Decimal("0.005");

export interface RevaluationLinePreview {
  accountId: string;
  accountCode: string;
  accountName: string;
  currency: string;
  foreignBalance: number;
  oldRate: number;
  newRate: number;
  baseBefore: number;
  baseAfter: number;
  gainLoss: number;
}

export const currencyService = {
  // ── Rate book ─────────────────────────────────────────────
  listRates(organizationId: string) {
    return prisma.orgExchangeRate.findMany({
      where: { organizationId },
      orderBy: [{ targetCurrency: "asc" }, { asOfDate: "desc" }],
    });
  },

  async upsertRate(organizationId: string, actor: Actor, input: { baseCurrency: string; targetCurrency: string; rate: number; asOfDate: Date; source?: string | null }) {
    if (input.baseCurrency === input.targetCurrency) throw new CurrencyError("Base and target currency must differ", 422);
    if (input.rate <= 0) throw new CurrencyError("Rate must be greater than zero", 422);

    const rate = await prisma.orgExchangeRate.upsert({
      where: {
        organizationId_baseCurrency_targetCurrency_asOfDate: {
          organizationId,
          baseCurrency: input.baseCurrency.toUpperCase(),
          targetCurrency: input.targetCurrency.toUpperCase(),
          asOfDate: input.asOfDate,
        },
      },
      create: {
        organizationId,
        baseCurrency: input.baseCurrency.toUpperCase(),
        targetCurrency: input.targetCurrency.toUpperCase(),
        rate: new Prisma.Decimal(input.rate),
        asOfDate: input.asOfDate,
        source: input.source ?? "manual",
      },
      update: { rate: new Prisma.Decimal(input.rate), source: input.source ?? "manual" },
    });

    await createAuditLog({
      organizationId, userId: actor.userId ?? undefined, action: "SETTINGS_CHANGE", entity: "exchange_rate", entityId: rate.id,
      description: `Set ${rate.baseCurrency}/${rate.targetCurrency} = ${input.rate} as of ${input.asOfDate.toISOString().slice(0, 10)}`,
    });
    return rate;
  },

  async deleteRate(organizationId: string, actor: Actor, id: string) {
    const rate = await prisma.orgExchangeRate.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!rate) throw new CurrencyError("Rate not found", 404);
    await prisma.orgExchangeRate.delete({ where: { id } });
    await createAuditLog({ organizationId, userId: actor.userId ?? undefined, action: "DELETE", entity: "exchange_rate", entityId: id, description: "Deleted exchange rate" });
  },

  /** Latest rate for base→target with asOfDate <= the given date. */
  async getRateAsOf(organizationId: string, baseCurrency: string, targetCurrency: string, asOf: Date): Promise<Prisma.Decimal | null> {
    const row = await prisma.orgExchangeRate.findFirst({
      where: { organizationId, baseCurrency, targetCurrency, asOfDate: { lte: asOf } },
      orderBy: { asOfDate: "desc" },
      select: { rate: true },
    });
    return row?.rate ?? null;
  },

  // ── Revaluation ───────────────────────────────────────────
  listRevaluations(organizationId: string) {
    return prisma.currencyRevaluation.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { lines: true } } },
    });
  },

  /** Compute (without posting) the unrealized gain/loss per (account, currency). */
  async compute(organizationId: string, asOf: Date): Promise<{ baseCurrency: string; lines: RevaluationLinePreview[]; totalGainLoss: number }> {
    const settings = await getAccountingSettings(organizationId);
    const base = settings.baseCurrency;

    const rows = await prisma.$queryRaw<{
      account_id: string;
      account_code: string;
      account_name: string;
      currency: string;
      type: string;
      amount: string;
      exchange_rate: string;
    }[]>`
      SELECT jl."accountId" AS account_id, a.code AS account_code, a.name AS account_name,
        je.currency AS currency, jl.type AS type, jl.amount::text AS amount, je."exchangeRate"::text AS exchange_rate
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."journalEntryId"
      JOIN accounts a ON a.id = jl."accountId"
      WHERE je."organizationId" = ${organizationId}
        AND je."deletedAt" IS NULL AND je.status = 'POSTED'
        AND je.currency <> ${base}
        AND je."entryDate" <= ${asOf}
    `;

    // Aggregate per (account, currency): base balance + implied foreign balance.
    type Agg = { accountCode: string; accountName: string; currency: string; netBase: Prisma.Decimal; netForeign: Prisma.Decimal };
    const map = new Map<string, Agg & { accountId: string }>();
    for (const r of rows) {
      const rate = new Prisma.Decimal(r.exchange_rate || "1");
      const amt = new Prisma.Decimal(r.amount);
      const signed = r.type === "DEBIT" ? amt : amt.neg();
      const foreign = rate.isZero() ? ZERO : signed.div(rate);
      const key = `${r.account_id}:${r.currency}`;
      const existing = map.get(key);
      if (existing) {
        existing.netBase = existing.netBase.add(signed);
        existing.netForeign = existing.netForeign.add(foreign);
      } else {
        map.set(key, { accountId: r.account_id, accountCode: r.account_code, accountName: r.account_name, currency: r.currency, netBase: signed, netForeign: foreign });
      }
    }

    const lines: RevaluationLinePreview[] = [];
    let total = ZERO;
    for (const agg of map.values()) {
      if (agg.netForeign.abs().lt(new Prisma.Decimal("0.0001"))) continue;
      const newRate = await this.getRateAsOf(organizationId, base, agg.currency, asOf);
      if (!newRate) continue; // no rate on file → cannot revalue
      const baseAfter = agg.netForeign.mul(newRate);
      const gainLoss = baseAfter.sub(agg.netBase);
      if (gainLoss.abs().lt(CENT)) continue;
      const oldRate = agg.netForeign.isZero() ? newRate : agg.netBase.div(agg.netForeign);
      total = total.add(gainLoss);
      lines.push({
        accountId: agg.accountId,
        accountCode: agg.accountCode,
        accountName: agg.accountName,
        currency: agg.currency,
        foreignBalance: Number(agg.netForeign.toFixed(4)),
        oldRate: Number(oldRate.toFixed(8)),
        newRate: Number(newRate.toFixed(8)),
        baseBefore: Number(agg.netBase.toFixed(2)),
        baseAfter: Number(baseAfter.toFixed(2)),
        gainLoss: Number(gainLoss.toFixed(2)),
      });
    }

    return { baseCurrency: base, lines, totalGainLoss: Number(total.toFixed(2)) };
  },

  async resolveForexAccountId(organizationId: string): Promise<string> {
    const settings = await getAccountingSettings(organizationId);
    if (settings.forexGainLossAccountId) return settings.forexGainLossAccountId;
    const byCode = await prisma.account.findFirst({ where: { organizationId, code: "4900", deletedAt: null }, select: { id: true } });
    if (byCode) return byCode.id;
    throw new CurrencyError("No Forex Gain/Loss account found — create one (e.g. code 4900) or set it in Accounting settings", 422);
  },

  /** Post the revaluation: a FOREX journal + a CurrencyRevaluation record. */
  async post(organizationId: string, actor: Actor, asOf: Date) {
    const { baseCurrency, lines, totalGainLoss } = await this.compute(organizationId, asOf);
    if (lines.length === 0) throw new CurrencyError("Nothing to revalue for this date", 422);

    const forexAccountId = await this.resolveForexAccountId(organizationId);

    // Build journal lines: per-account adjustment + single forex offset.
    const journalLines: { accountId: string; type: "DEBIT" | "CREDIT"; amount: Prisma.Decimal; description: string }[] = [];
    let sumDebit = ZERO;
    let sumCredit = ZERO;
    for (const l of lines) {
      const delta = new Prisma.Decimal(l.gainLoss);
      if (delta.gt(0)) { journalLines.push({ accountId: l.accountId, type: "DEBIT", amount: delta, description: `FX revaluation ${l.currency}` }); sumDebit = sumDebit.add(delta); }
      else { const amt = delta.abs(); journalLines.push({ accountId: l.accountId, type: "CREDIT", amount: amt, description: `FX revaluation ${l.currency}` }); sumCredit = sumCredit.add(amt); }
    }
    const net = new Prisma.Decimal(totalGainLoss); // sumDebit - sumCredit
    if (net.gt(0)) { journalLines.push({ accountId: forexAccountId, type: "CREDIT", amount: net, description: "Unrealized FX gain" }); sumCredit = sumCredit.add(net); }
    else if (net.lt(0)) { journalLines.push({ accountId: forexAccountId, type: "DEBIT", amount: net.abs(), description: "Unrealized FX loss" }); sumDebit = sumDebit.add(net.abs()); }

    const result = await prisma.$transaction(async (tx) => {
      const journalNumber = await generateNextJournalNumber(organizationId, { client: tx });
      const journal = await tx.journalEntry.create({
        data: {
          organizationId, journalNumber, status: "POSTED", journalType: "FOREX",
          reference: `FX-${asOf.toISOString().slice(0, 10)}`, description: `Currency revaluation as of ${asOf.toISOString().slice(0, 10)}`,
          entryDate: asOf, totalDebit: sumDebit, totalCredit: sumCredit, createdById: actor.userId, postedById: actor.userId, postedAt: new Date(),
          lines: { create: journalLines.map((l, i) => ({ accountId: l.accountId, type: l.type, amount: l.amount, description: l.description, lineOrder: i })) },
        },
        select: { id: true, journalNumber: true },
      });

      const reval = await tx.currencyRevaluation.create({
        data: {
          organizationId, asOfDate: asOf, baseCurrency, status: "POSTED",
          totalGainLoss: new Prisma.Decimal(totalGainLoss), journalEntryId: journal.id, createdById: actor.userId,
          lines: {
            create: lines.map((l) => ({
              accountId: l.accountId, currency: l.currency,
              foreignBalance: new Prisma.Decimal(l.foreignBalance), oldRate: new Prisma.Decimal(l.oldRate), newRate: new Prisma.Decimal(l.newRate),
              baseBefore: new Prisma.Decimal(l.baseBefore), baseAfter: new Prisma.Decimal(l.baseAfter), gainLoss: new Prisma.Decimal(l.gainLoss),
            })),
          },
        },
        select: { id: true },
      });

      await recomputeAccountBalances(tx, organizationId, [...new Set(journalLines.map((l) => l.accountId))]);
      return { revaluationId: reval.id, journalNumber: journal.journalNumber };
    });

    await createAuditLog({
      organizationId, userId: actor.userId ?? undefined, action: "POST", entity: "currency_revaluation", entityId: result.revaluationId,
      description: `Posted FX revaluation as of ${asOf.toISOString().slice(0, 10)} (net ${totalGainLoss})`,
    });

    return { ...result, totalGainLoss, lineCount: lines.length };
  },
};
