import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { adminKycService } from "@/lib/services/admin-kyc.service";

type RouteCtx = { params: Promise<{ orgId: string }> };

export async function POST(req: Request, { params }: RouteCtx) {
  try {
    const user = await getCurrentUser().catch(() => null);
    if (!user || user.userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { orgId } = await params;
    const body = await req.json().catch(() => null);
    const decision = body?.decision as "APPROVE" | "REJECT" | undefined;
    if (decision !== "APPROVE" && decision !== "REJECT") {
      return NextResponse.json({ error: "decision must be APPROVE or REJECT" }, { status: 400 });
    }
    if (decision === "REJECT" && !body?.reason) {
      return NextResponse.json({ error: "reason is required to reject" }, { status: 400 });
    }

    const result =
      decision === "APPROVE"
        ? await adminKycService.approve(orgId, { userId: user.id })
        : await adminKycService.reject(orgId, { userId: user.id }, body.reason);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ADMIN_KYC_DECISION]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
