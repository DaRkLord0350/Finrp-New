// /api/tax/financials — fetch + generate Balance Sheet & P&L
import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { generateFinancialStatements, getFinancialStatements } from "@/lib/tax/financials/service";
import { taxAudit } from "@/lib/tax/core/audit";

export const GET = withTenant(async (req, { organizationId }) => {
  const fy = new URL(req.url).searchParams.get("fy");
  if (!fy) return NextResponse.json({ error: "fy required" }, { status: 400 });
  return NextResponse.json(await getFinancialStatements(organizationId, fy));
}, { permission: "tax.read" });

const Schema = z.object({ financialYear: z.string().min(4) });

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await generateFinancialStatements({ organizationId, financialYear: parsed.data.financialYear, generatedById: userId });
    await taxAudit({ organizationId, userId, action: "UPDATE", entity: "tax.financials", description: `Generated financial statements for ${parsed.data.financialYear}` });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}, { permission: "tax.write" });
