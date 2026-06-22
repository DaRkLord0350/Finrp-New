// ============================================================
// /api/tax/gst/reconcile
// GET  — latest reconciliation + mismatches for a period
// POST — run a books-vs-2B reconciliation for a period
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { prisma } from "@/lib/prisma";
import { reconcile2b } from "@/lib/tax/gst/reconcile";
import { getPrimaryGstin } from "@/lib/tax/gst/service";
import { taxAudit } from "@/lib/tax/core/audit";

export const GET = withTenant(async (req, { organizationId }) => {
  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? undefined;
  const recon = await prisma.gstReconciliation.findFirst({
    where: { organizationId, ...(period ? { period } : {}) },
    orderBy: { createdAt: "desc" },
    include: { mismatches: { orderBy: { createdAt: "asc" }, take: 1000 } },
  });
  return NextResponse.json({ reconciliation: recon });
}, { permission: "tax.read" });

const RunSchema = z.object({
  period: z.string().regex(/^\d{6}$/),
  gstin: z.string().length(15).optional(),
});

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const body = await req.json().catch(() => null);
  const parsed = RunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const gstin = parsed.data.gstin ?? (await getPrimaryGstin(organizationId));
  if (!gstin) return NextResponse.json({ error: "No GST profile found" }, { status: 400 });

  const result = await reconcile2b(organizationId, gstin, parsed.data.period, userId);

  await taxAudit({
    organizationId,
    userId,
    action: "UPDATE",
    entity: "tax.gst.reconciliation",
    entityId: result.reconciliationId,
    description: `Reconciled GSTR-2B for ${parsed.data.period}: ${result.matchedCount} matched, ${result.mismatchCount} mismatches`,
  });

  return NextResponse.json(result, { status: 201 });
}, { permission: "tax.write" });
