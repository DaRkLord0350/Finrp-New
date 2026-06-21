// ============================================================
// lib/tax/capital-gains/service.ts
//
// Capital gains engine: STCG/LTCG classification by holding period +
// asset class, CII indexation (from versioned config), section 112A
// equity exemption, and a per-FY summary. Supports broker CSV import.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { CapitalAssetKind, CapitalGainTermKind, Prisma } from "@prisma/client";
import { resolveTaxConfig } from "../config/loader";
import type { CapitalGainsConfig } from "../config/types";
import { round2, toNumber } from "../core/money";
import { financialYearOf } from "../core/period";
import type { RawRow } from "../import/types";

// Holding-period thresholds (months) for LTCG by asset class.
const LTCG_MONTHS: Record<CapitalAssetKind, number> = {
  EQUITY_STT: 12,
  MUTUAL_FUND_EQUITY: 12,
  UNLISTED_SHARES: 24,
  PROPERTY: 24,
  MUTUAL_FUND_DEBT: 36,
  GOLD: 24,
  OTHER: 24,
};

const INDEXABLE: CapitalAssetKind[] = ["PROPERTY", "GOLD", "UNLISTED_SHARES", "OTHER"];
const EQUITY_112A: CapitalAssetKind[] = ["EQUITY_STT", "MUTUAL_FUND_EQUITY"];

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export function classifyTerm(assetType: CapitalAssetKind, purchaseDate: Date, saleDate: Date): CapitalGainTermKind {
  return monthsBetween(purchaseDate, saleDate) >= LTCG_MONTHS[assetType] ? "LTCG" : "STCG";
}

export interface GainComputation {
  term: CapitalGainTermKind;
  indexedCost: number | null;
  gain: number;
  rate: number;
  taxableGain: number;
  taxAmount: number;
}

/** Compute a single transaction's gain + tax (equity 112A exemption applied at summary). */
export function computeGain(
  params: { assetType: CapitalAssetKind; purchaseDate: Date; saleDate: Date; purchaseValue: number; saleValue: number; expenses: number },
  cg: CapitalGainsConfig
): GainComputation {
  const term = classifyTerm(params.assetType, params.purchaseDate, params.saleDate);
  const net = params.saleValue - params.expenses;

  let cost = params.purchaseValue;
  let indexedCost: number | null = null;
  let rate = 0;

  if (term === "LTCG" && INDEXABLE.includes(params.assetType)) {
    const pFy = financialYearOf(params.purchaseDate);
    const sFy = financialYearOf(params.saleDate);
    const ciiP = cg.cii[pFy];
    const ciiS = cg.cii[sFy];
    if (ciiP && ciiS) {
      indexedCost = round2((params.purchaseValue * ciiS) / ciiP).toNumber();
      cost = indexedCost;
      rate = 20; // indexation method
    } else {
      rate = cg.ltcgOtherRatePct; // no CII available → non-indexed rate
    }
  } else if (term === "LTCG" && EQUITY_112A.includes(params.assetType)) {
    rate = cg.ltcgEquityRatePct;
  } else if (term === "STCG" && EQUITY_112A.includes(params.assetType)) {
    rate = cg.stcgEquityRatePct; // 111A
  } else {
    rate = 0; // other STCG taxed at slab in the ITR module
  }

  const gain = round2(net - cost).toNumber();
  const taxableGain = Math.max(0, gain);
  const taxAmount = round2((taxableGain * rate) / 100).toNumber();
  return { term, indexedCost, gain, rate, taxableGain, taxAmount };
}

export async function createCapitalGainTxn(params: {
  organizationId: string;
  assetType: CapitalAssetKind;
  description?: string;
  quantity?: number;
  purchaseDate: string;
  saleDate: string;
  purchaseValue: number;
  saleValue: number;
  expenses?: number;
  createdById?: string;
}) {
  const cfgFy = financialYearOf(new Date(params.saleDate));
  const config = await resolveTaxConfig({ scheme: "CAPITAL_GAINS", period: cfgFy, organizationId: params.organizationId });

  const comp = computeGain(
    {
      assetType: params.assetType,
      purchaseDate: new Date(params.purchaseDate),
      saleDate: new Date(params.saleDate),
      purchaseValue: params.purchaseValue,
      saleValue: params.saleValue,
      expenses: params.expenses ?? 0,
    },
    config.capitalGains
  );

  return prisma.capitalGainTxn.create({
    data: {
      organizationId: params.organizationId,
      financialYear: cfgFy,
      assetType: params.assetType,
      description: params.description,
      quantity: params.quantity != null ? round2(params.quantity) : null,
      purchaseDate: new Date(params.purchaseDate),
      saleDate: new Date(params.saleDate),
      purchaseValue: round2(params.purchaseValue),
      saleValue: round2(params.saleValue),
      expenses: round2(params.expenses ?? 0),
      term: comp.term,
      indexedCost: comp.indexedCost != null ? round2(comp.indexedCost) : null,
      gain: round2(comp.gain),
      taxableGain: round2(comp.taxableGain),
      taxRate: comp.rate,
      taxAmount: round2(comp.taxAmount),
      createdById: params.createdById,
    },
  });
}

export async function listCapitalGainTxns(organizationId: string, financialYear?: string) {
  return prisma.capitalGainTxn.findMany({
    where: { organizationId, deletedAt: null, ...(financialYear ? { financialYear } : {}) },
    orderBy: { saleDate: "desc" },
    take: 500,
  });
}

export interface CapitalGainSummary {
  financialYear: string;
  equityLtcgGain: number;
  equityLtcgExemption: number;
  equityLtcgTaxable: number;
  equityLtcgTax: number;
  equityStcgGain: number;
  equityStcgTax: number;
  otherLtcgGain: number;
  otherLtcgTax: number;
  otherStcgGain: number;
  totalTax: number;
  totalGain: number;
}

/** Aggregate gains for a FY and apply the single §112A equity exemption. */
export async function computeCapitalGainSummary(organizationId: string, financialYear: string): Promise<CapitalGainSummary> {
  const config = await resolveTaxConfig({ scheme: "CAPITAL_GAINS", period: financialYear, organizationId });
  const cg = config.capitalGains;
  const txns = await prisma.capitalGainTxn.findMany({ where: { organizationId, financialYear, deletedAt: null } });

  const isEquity = (t: CapitalAssetKind) => EQUITY_112A.includes(t);
  let equityLtcgGain = 0, equityStcgGain = 0, otherLtcgGain = 0, otherStcgGain = 0;

  for (const t of txns) {
    const gain = toNumber(t.taxableGain);
    if (isEquity(t.assetType)) {
      if (t.term === "LTCG") equityLtcgGain += gain;
      else equityStcgGain += gain;
    } else {
      if (t.term === "LTCG") otherLtcgGain += gain;
      else otherStcgGain += gain;
    }
  }

  const equityLtcgExemption = Math.min(equityLtcgGain, cg.ltcgEquityExemption);
  const equityLtcgTaxable = Math.max(0, equityLtcgGain - equityLtcgExemption);
  const equityLtcgTax = round2((equityLtcgTaxable * cg.ltcgEquityRatePct) / 100).toNumber();
  const equityStcgTax = round2((equityStcgGain * cg.stcgEquityRatePct) / 100).toNumber();
  // Other LTCG tax recomputed from stored per-txn taxAmount (handles indexation).
  const otherLtcgTax = round2(
    txns.filter((t) => !isEquity(t.assetType) && t.term === "LTCG").reduce((s, t) => s + toNumber(t.taxAmount), 0)
  ).toNumber();

  const totalTax = round2(equityLtcgTax + equityStcgTax + otherLtcgTax).toNumber();
  const totalGain = round2(equityLtcgGain + equityStcgGain + otherLtcgGain + otherStcgGain).toNumber();

  return {
    financialYear, equityLtcgGain: round2(equityLtcgGain).toNumber(), equityLtcgExemption: round2(equityLtcgExemption).toNumber(),
    equityLtcgTaxable: round2(equityLtcgTaxable).toNumber(), equityLtcgTax, equityStcgGain: round2(equityStcgGain).toNumber(),
    equityStcgTax, otherLtcgGain: round2(otherLtcgGain).toNumber(), otherLtcgTax, otherStcgGain: round2(otherStcgGain).toNumber(),
    totalTax, totalGain,
  };
}

export interface BrokerTxnRow {
  assetType: CapitalAssetKind;
  description?: string;
  quantity?: number;
  purchaseDate: string;
  saleDate: string;
  purchaseValue: number;
  saleValue: number;
  expenses: number;
}

/** Map flexible broker CSV rows into capital-gain transactions. */
export function normalizeBrokerRows(rows: RawRow[]): BrokerTxnRow[] {
  const pick = (raw: RawRow, keys: string[]): string | undefined => {
    const lower = new Map<string, unknown>();
    for (const [k, v] of Object.entries(raw)) lower.set(k.toLowerCase().replace(/[\s_]+/g, ""), v);
    for (const key of keys) { const hit = lower.get(key.toLowerCase().replace(/[\s_]+/g, "")); if (hit !== undefined && hit !== null && hit !== "") return String(hit).trim(); }
    return undefined;
  };
  const num = (v?: string) => { if (!v) return 0; const x = Number(v.replace(/[, ]/g, "")); return Number.isFinite(x) ? x : 0; };
  const assetMap: Record<string, CapitalAssetKind> = { equity: "EQUITY_STT", mf: "MUTUAL_FUND_EQUITY", debt: "MUTUAL_FUND_DEBT", property: "PROPERTY", gold: "GOLD", unlisted: "UNLISTED_SHARES" };

  return rows
    .map((r) => {
      const a = (pick(r, ["asset_type", "asset", "type"]) ?? "equity").toLowerCase();
      return {
        assetType: assetMap[a] ?? "OTHER",
        description: pick(r, ["description", "scrip", "security", "name"]),
        quantity: num(pick(r, ["quantity", "qty", "units"])) || undefined,
        purchaseDate: pick(r, ["purchase_date", "buy_date", "acquisition_date"]) ?? "",
        saleDate: pick(r, ["sale_date", "sell_date"]) ?? "",
        purchaseValue: num(pick(r, ["purchase_value", "buy_value", "cost"])),
        saleValue: num(pick(r, ["sale_value", "sell_value", "consideration"])),
        expenses: num(pick(r, ["expenses", "brokerage", "charges"])),
      };
    })
    .filter((t) => t.purchaseDate && t.saleDate);
}
