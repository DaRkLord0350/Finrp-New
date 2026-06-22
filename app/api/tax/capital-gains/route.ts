// /api/tax/capital-gains — list txns + summary; create a txn
import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { createCapitalGainTxn, listCapitalGainTxns, computeCapitalGainSummary } from "@/lib/tax/capital-gains/service";
import { financialYearOf } from "@/lib/tax/core/period";
import { taxAudit } from "@/lib/tax/core/audit";

export const GET = withTenant(async (req, { organizationId }) => {
  const fy = new URL(req.url).searchParams.get("fy") ?? financialYearOf(new Date());
  const [txns, summary] = await Promise.all([
    listCapitalGainTxns(organizationId, fy),
    computeCapitalGainSummary(organizationId, fy),
  ]);
  return NextResponse.json({ txns, summary });
}, { permission: "tax.read" });

const Schema = z.object({
  assetType: z.enum(["EQUITY_STT", "MUTUAL_FUND_EQUITY", "MUTUAL_FUND_DEBT", "PROPERTY", "GOLD", "UNLISTED_SHARES", "OTHER"]),
  description: z.string().optional(),
  quantity: z.number().optional(),
  purchaseDate: z.string(),
  saleDate: z.string(),
  purchaseValue: z.number(),
  saleValue: z.number(),
  expenses: z.number().optional(),
});

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  const txn = await createCapitalGainTxn({ organizationId, createdById: userId, ...parsed.data });
  await taxAudit({ organizationId, userId, action: "CREATE", entity: "tax.capitalgains.txn", entityId: txn.id, description: `Capital gain txn ${parsed.data.assetType} (${txn.term})` });
  return NextResponse.json({ id: txn.id, term: txn.term, gain: txn.gain, taxAmount: txn.taxAmount }, { status: 201 });
}, { permission: "tax.write" });
