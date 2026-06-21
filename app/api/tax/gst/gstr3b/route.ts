// ============================================================
// /api/tax/gst/gstr3b
// GET  — fetch the GSTR-3B computation for a period
// POST — compute GSTR-3B and move the filing to READY
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { can } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { prepareGstr3b, getPrimaryGstin } from "@/lib/tax/gst/service";
import { taxAudit } from "@/lib/tax/core/audit";

export const GET = withTenant(async (req, { organizationId }) => {
  const url = new URL(req.url);
  const period = url.searchParams.get("period");
  const gstin = url.searchParams.get("gstin") ?? (await getPrimaryGstin(organizationId));
  if (!period || !gstin) return NextResponse.json({ error: "period and gstin are required" }, { status: 400 });

  const computation = await prisma.gstr3bComputation.findUnique({
    where: { organizationId_gstin_period: { organizationId, gstin, period } },
  });
  return NextResponse.json({ computation });
}, { permission: "tax.read" });

const PrepareSchema = z.object({
  period: z.string().regex(/^\d{6}$/, "period must be MMYYYY"),
  gstin: z.string().length(15).optional(),
});

export const POST = withTenant(async (req, { organizationId, userId, role }) => {
  const body = await req.json().catch(() => null);
  const parsed = PrepareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const gstin = parsed.data.gstin ?? (await getPrimaryGstin(organizationId));
  if (!gstin) return NextResponse.json({ error: "No GST profile found" }, { status: 400 });

  const result = await prepareGstr3b({
    organizationId,
    gstin,
    period: parsed.data.period,
    actor: { userId, role, canApprove: can(role, "tax.approve") },
  });

  await taxAudit({
    organizationId,
    userId,
    action: "UPDATE",
    entity: "tax.gst.gstr3b",
    entityId: result.submission.id,
    description: `Computed GSTR-3B for ${parsed.data.period}`,
  });

  return NextResponse.json({
    submission: result.submission,
    result: {
      outward: result.result.outward,
      itc: result.result.itc,
      carriedForward: result.result.carriedForward,
      netPayable: result.result.netPayable,
      closing: result.result.closing,
    },
  });
}, { permission: "tax.write" });
