// ============================================================
// lib/invoices/tds-sections.ts
//
// Configurable TDS / TCS sections per organization. A common Indian
// default set is seeded lazily on first read; every section's rate is
// editable, so the seeded rates are representative defaults only.
// ============================================================

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface TdsTcsSectionSeed {
  type: "TDS" | "TCS";
  code: string;
  name: string;
  rate: number;
}

export const DEFAULT_TDS_TCS_SECTIONS: TdsTcsSectionSeed[] = [
  // ── TDS (deducted at source) ──────────────────────────────
  { type: "TDS", code: "194C", name: "Payment to Contractors", rate: 1 },
  { type: "TDS", code: "194J", name: "Professional / Technical Fees", rate: 10 },
  { type: "TDS", code: "194H", name: "Commission or Brokerage", rate: 5 },
  { type: "TDS", code: "194I(a)", name: "Rent — Plant & Machinery", rate: 2 },
  { type: "TDS", code: "194I(b)", name: "Rent — Land / Building", rate: 10 },
  { type: "TDS", code: "194A", name: "Interest (other than securities)", rate: 10 },
  { type: "TDS", code: "194Q", name: "Purchase of Goods", rate: 0.1 },
  { type: "TDS", code: "194", name: "Dividend", rate: 10 },
  // ── TCS (collected at source) ─────────────────────────────
  { type: "TCS", code: "206C(1H)", name: "Sale of Goods", rate: 0.1 },
  { type: "TCS", code: "206C(1)", name: "Sale of Scrap", rate: 1 },
  { type: "TCS", code: "206C(1F)", name: "Sale of Motor Vehicle (> ₹10L)", rate: 1 },
  { type: "TCS", code: "206C(1G)", name: "Foreign Remittance / Tour Package", rate: 5 },
];

/**
 * Idempotently ensure an org has its default TDS/TCS sections, then return all
 * active sections. Safe to call on every read of the sections list.
 */
export async function ensureTdsTcsSections(organizationId: string) {
  const count = await prisma.tdsTcsSection.count({ where: { organizationId } });
  if (count === 0) {
    await prisma.tdsTcsSection.createMany({
      data: DEFAULT_TDS_TCS_SECTIONS.map((s) => ({
        organizationId,
        type: s.type,
        code: s.code,
        name: s.name,
        rate: new Prisma.Decimal(s.rate),
      })),
      skipDuplicates: true,
    });
  }
  return prisma.tdsTcsSection.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });
}
