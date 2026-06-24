// ============================================================
// /api/portal/access
//   GET  → list client portal access rows (firm-side)
//   POST → grant / suspend portal access for a customer
//
// RBAC: firm admin (or platform admin). CAs read-only via GET.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireFirmSide } from "@/lib/client-portal/auth";
import { listClientAccess } from "@/lib/client-portal/queries";
import { grantClientPortalAccess } from "@/lib/client-portal/service";

export async function GET() {
  const actor = await requireFirmSide();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clients = await listClientAccess(actor.organizationId);
  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const actor = await requireFirmSide();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.userRole !== "CA_FIRM_ADMIN" && actor.userRole !== "ADMIN") {
    return NextResponse.json({ error: "Only firm admins can manage portal access" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });

  const status = body.status === "SUSPENDED" ? "SUSPENDED" : body.status === "INVITED" ? "INVITED" : "ACTIVE";
  const result = await grantClientPortalAccess(actor, String(body.customerId), status);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ access: result.data }, { status: 201 });
}
