import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapFraudError } from "@/lib/fraud/http";
import { reviewAlert } from "@/lib/fraud/case-service";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "fraud.review" });
    const { id } = await params;
    const { action, notes } = await req.json();
    if (action !== "REVIEWED" && action !== "DISMISSED") {
      return NextResponse.json({ error: "action must be 'REVIEWED' or 'DISMISSED'" }, { status: 400 });
    }
    const alert = await reviewAlert(id, organizationId, action, notes, { userId });
    return NextResponse.json({ alert });
  } catch (err) {
    return mapFraudError(err, "FRAUD_ALERT_PATCH");
  }
}
