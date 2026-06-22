// ============================================================
// /api/tax/gst/profiles
// GET  — list the org's GST registration profiles
// POST — create/update a GST profile
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { ensureGstProfile, listGstProfiles } from "@/lib/tax/gst/service";
import { taxAudit } from "@/lib/tax/core/audit";

export const GET = withTenant(async (_req, { organizationId }) => {
  const profiles = await listGstProfiles(organizationId);
  return NextResponse.json({ profiles });
}, { permission: "tax.read" });

const CreateProfileSchema = z.object({
  gstin: z.string().length(15),
  legalName: z.string().optional(),
  tradeName: z.string().optional(),
  regType: z.enum(["REGULAR", "COMPOSITION", "SEZ", "SEZ_DEVELOPER", "UIN", "UNREGISTERED"]).optional(),
  filingFrequency: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const body = await req.json().catch(() => null);
  const parsed = CreateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const profile = await ensureGstProfile({ organizationId, ...parsed.data });
  await taxAudit({
    organizationId,
    userId,
    action: "CREATE",
    entity: "tax.gst.profile",
    entityId: profile.id,
    description: `Saved GST profile ${profile.gstin}`,
  });
  return NextResponse.json({ profile }, { status: 201 });
}, { permission: "tax.write" });
