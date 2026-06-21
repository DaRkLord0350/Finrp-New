// ============================================================
// /api/tax/seed
// POST — load demo GST data + seed default validation rules for the
//        caller's org (onboarding / verification helper). tax.manage.
// ============================================================

import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { seedGstDemo } from "@/lib/tax/gst/seed";
import { taxAudit } from "@/lib/tax/core/audit";

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const body = await req.json().catch(() => ({}));
  const month = Number(body?.month) || undefined;
  const year = Number(body?.year) || undefined;

  const result = await seedGstDemo({ organizationId, createdById: userId, month, year });

  await taxAudit({
    organizationId,
    userId,
    action: "IMPORT",
    entity: "tax.gst.seed",
    description: `Loaded GST demo data for ${result.period} (${result.outwardCreated} sales, ${result.inwardCreated} purchases)`,
  });

  return NextResponse.json(result, { status: 201 });
}, { permission: "tax.manage" });
