// ============================================================
// /api/ca/workspace/clients — organizations the current CA can
// open a workspace for. Feeds the CustomerSwitcher dropdown and
// the "Assigned Customers" page refresh.
// ============================================================

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listOpenableClients } from "@/lib/workspace/assignments";

export async function GET() {
  try {
    let user;
    try {
      user = await getCurrentUser();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.userRole || user.userRole === "CUSTOMER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clients = await listOpenableClients({
      id: user.id,
      userRole: user.userRole,
      firmId: user.firmId,
    });

    return NextResponse.json({
      clients: clients.map((c) => ({
        organizationId: c.organization.id,
        name: c.organization.businessProfile?.businessName ?? c.organization.name,
        businessType: c.organization.businessProfile?.businessType ?? null,
        gstin: c.organization.businessProfile?.gstin ?? null,
        permissions: c.permissions,
        assignedAt: c.assignedAt,
      })),
    });
  } catch (error) {
    console.error("[GET /api/ca/workspace/clients]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
