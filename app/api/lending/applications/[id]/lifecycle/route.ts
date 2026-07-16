// Consolidated endpoint for terminal / pause actions that don't fit the
// linear pipeline: reject, withdraw, hold, release-hold.
import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { rejectApplication, withdrawApplication, holdApplication, releaseHold } from "@/lib/lending/workflow/service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "lending.write" });
    const { id } = await params;
    const { action, reason } = await req.json();
    const actor = { userId, role };

    let application;
    switch (action) {
      case "reject":
        application = await rejectApplication({ applicationId: id, organizationId, reason: reason ?? "Rejected by underwriter", actor });
        break;
      case "withdraw":
        application = await withdrawApplication({ applicationId: id, organizationId, reason, actor });
        break;
      case "hold":
        application = await holdApplication({ applicationId: id, organizationId, reason: reason ?? "On hold", actor });
        break;
      case "release-hold":
        application = await releaseHold({ applicationId: id, organizationId, actor });
        break;
      default:
        return NextResponse.json({ error: "Unknown action — expected reject, withdraw, hold, or release-hold" }, { status: 400 });
    }
    return NextResponse.json({ application });
  } catch (err) {
    return mapLendingError(err, "LENDING_APPLICATION_LIFECYCLE");
  }
}
