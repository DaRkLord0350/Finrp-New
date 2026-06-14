// ============================================================
// /api/ca/workspace/activity — ClientActivityLog feed.
//
// Authorization:
//   ADMIN          → any organization, or the full stream
//   CA/FIRM_ADMIN  → orgs they hold workspace access to, plus
//                    their own activity stream
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getClientActivity } from "@/lib/workspace/audit";
import { resolveWorkspaceAccess } from "@/lib/workspace/assignments";

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get("organizationId") ?? undefined;
    const limit = Number(searchParams.get("limit") ?? 50);
    const cursor = searchParams.get("cursor") ?? undefined;

    if (organizationId && user.userRole !== "ADMIN") {
      const access = await resolveWorkspaceAccess(
        { id: user.id, userRole: user.userRole, firmId: user.firmId },
        organizationId
      );
      if (!access.allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const result = await getClientActivity({
      organizationId,
      // Non-admins without an org filter see only their own actions.
      caUserId: !organizationId && user.userRole !== "ADMIN" ? user.id : undefined,
      limit,
      cursor,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/ca/workspace/activity]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
