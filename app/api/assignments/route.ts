// ============================================================
// POST /api/assignments  — assign a CA to a customer
//   Body: { customerId, caId, notes? }
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// Reuses CustomerAssignment + Notification + audit trail.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { clientIpFrom } from "@/lib/team/activity";
import { verifyCustomer, verifyCa, createAssignment } from "@/lib/firm/assignments";

export async function POST(req: NextRequest) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { customerId, caId, notes } = body as { customerId?: string; caId?: string; notes?: string };
  if (!customerId || !caId)
    return NextResponse.json({ error: "customerId and caId are required" }, { status: 400 });

  const customer = await verifyCustomer(admin.organizationId, customerId);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const ca = await verifyCa(admin.organizationId, caId);
  if (!ca) return NextResponse.json({ error: "CA not found in this firm" }, { status: 404 });

  const assignment = await createAssignment({
    admin,
    customerId,
    caId,
    notes: notes?.trim() || null,
    action: "CA_ASSIGNED",
    ipAddress: clientIpFrom(req),
  });

  return NextResponse.json({ assignment }, { status: 201 });
}
