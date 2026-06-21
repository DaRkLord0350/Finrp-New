// /api/tax/income-tax — list + compute ITR (both regimes, recommendation, filing)
import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { can } from "@/lib/auth/rbac";
import { computeItr, listItrComputations } from "@/lib/tax/income-tax/service";
import { taxAudit } from "@/lib/tax/core/audit";

export const GET = withTenant(async (req, { organizationId }) => {
  const ay = new URL(req.url).searchParams.get("ay") ?? undefined;
  return NextResponse.json({ computations: await listItrComputations(organizationId, ay) });
}, { permission: "tax.read" });

const Schema = z.object({
  assessmentYear: z.string().min(4),
  regime: z.enum(["OLD", "NEW"]).optional(),
  pan: z.string().optional(),
  salary: z.number().default(0),
  houseProperty: z.number().default(0),
  business: z.number().default(0),
  capitalGains: z.number().default(0),
  other: z.number().default(0),
  deductions: z.record(z.string(), z.number()).default({}),
  isSalaried: z.boolean().default(true),
  advanceTaxPaid: z.number().default(0),
  tdsCredit: z.number().default(0),
});

export const POST = withTenant(async (req, { organizationId, userId, role }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  const result = await computeItr({ organizationId, actor: { userId, role, canApprove: can(role, "tax.approve") }, ...parsed.data });
  await taxAudit({ organizationId, userId, action: "UPDATE", entity: "tax.itr", entityId: result.submission.id, description: `Computed ITR ${parsed.data.assessmentYear} — recommended ${result.comparison.recommended} regime` });
  return NextResponse.json({
    submission: result.submission,
    comparison: result.comparison,
    result: result.result,
    form: result.form,
  });
}, { permission: "tax.write" });
