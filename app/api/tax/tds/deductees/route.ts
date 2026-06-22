// /api/tax/tds/deductees — list + create deductees
import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { createDeductee, listDeductees } from "@/lib/tax/tds/service";
import { taxAudit } from "@/lib/tax/core/audit";

export const GET = withTenant(async (_req, { organizationId }) => {
  return NextResponse.json({ deductees: await listDeductees(organizationId) });
}, { permission: "tax.read" });

const Schema = z.object({
  name: z.string().min(1),
  pan: z.string().optional(),
  deducteeType: z.enum(["COMPANY", "INDIVIDUAL", "HUF", "FIRM", "AOP", "TRUST", "OTHER"]).optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
});

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  const deductee = await createDeductee({ organizationId, createdById: userId, ...parsed.data });
  await taxAudit({ organizationId, userId, action: "CREATE", entity: "tax.tds.deductee", entityId: deductee.id, description: `Added TDS deductee ${parsed.data.name}` });
  return NextResponse.json({ id: deductee.id }, { status: 201 });
}, { permission: "tax.write" });
