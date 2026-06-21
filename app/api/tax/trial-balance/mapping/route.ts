// /api/tax/trial-balance/mapping — save a ledger → head mapping override
import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { saveLedgerMapping } from "@/lib/tax/financials/service";

const Schema = z.object({
  ledgerName: z.string().min(1),
  group: z.string().min(1),
  head: z.string().min(1),
  statement: z.enum(["BALANCE_SHEET", "PROFIT_LOSS", "UNMAPPED"]),
});

export const POST = withTenant(async (req, { organizationId }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  const mapping = await saveLedgerMapping({ organizationId, ...parsed.data });
  return NextResponse.json({ mapping }, { status: 201 });
}, { permission: "tax.write" });
