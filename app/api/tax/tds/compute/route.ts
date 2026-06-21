// /api/tax/tds/compute — compute a quarterly TDS return + create filing
import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { can } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { computeTdsReturn } from "@/lib/tax/tds/service";
import { taxAudit } from "@/lib/tax/core/audit";

export const GET = withTenant(async (req, { organizationId }) => {
  const url = new URL(req.url);
  const fy = url.searchParams.get("fy") ?? undefined;
  const computations = await prisma.tdsReturnComputation.findMany({
    where: { organizationId, ...(fy ? { financialYear: fy } : {}) },
    orderBy: { updatedAt: "desc" }, take: 50,
  });
  return NextResponse.json({ computations });
}, { permission: "tax.read" });

const Schema = z.object({
  formType: z.enum(["FORM_24Q", "FORM_26Q", "FORM_27Q", "FORM_27EQ"]),
  financialYear: z.string().min(4),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
});

export const POST = withTenant(async (req, { organizationId, userId, role }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  const result = await computeTdsReturn({ organizationId, actor: { userId, role, canApprove: can(role, "tax.approve") }, ...parsed.data });
  await taxAudit({ organizationId, userId, action: "UPDATE", entity: "tax.tds.return", entityId: result.submission.id, description: `Computed ${parsed.data.formType} ${parsed.data.financialYear} ${parsed.data.quarter}` });
  return NextResponse.json({ computation: result.computation, submission: result.submission, payload: result.payload });
}, { permission: "tax.write" });
