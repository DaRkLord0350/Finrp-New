// /api/tax/audit — list reports + available forms; generate a report
import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { generateAuditReport, listAuditReports, listAuditForms } from "@/lib/tax/audit/service";
import { taxAudit } from "@/lib/tax/core/audit";

export const GET = withTenant(async (req, { organizationId }) => {
  const fy = new URL(req.url).searchParams.get("fy") ?? undefined;
  return NextResponse.json({ reports: await listAuditReports(organizationId, fy), forms: listAuditForms() });
}, { permission: "tax.read" });

const Schema = z.object({
  formType: z.enum(["FORM_3CA", "FORM_3CB", "FORM_3CD", "FORM_10B", "FORM_29B", "FORM_29C", "FORM_3CEB"]),
  financialYear: z.string().min(4),
  particulars: z.record(z.string(), z.unknown()).optional(),
});

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  const result = await generateAuditReport({ organizationId, generatedById: userId, ...parsed.data });
  await taxAudit({ organizationId, userId, action: "UPDATE", entity: "tax.audit.report", entityId: result.report.id, description: `Generated ${parsed.data.formType} for ${parsed.data.financialYear}` });
  return NextResponse.json({ report: result.report, built: result.built });
}, { permission: "tax.write" });
