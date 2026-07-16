import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapAmlError } from "@/lib/aml/http";
import { reviewAlert } from "@/lib/aml/case-service";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "aml.review" });
    const { id } = await params;
    const { action, notes } = await req.json();
    if (action !== "REVIEWED" && action !== "DISMISSED") {
      return NextResponse.json({ error: "action must be 'REVIEWED' or 'DISMISSED'" }, { status: 400 });
    }
    const alert = await reviewAlert(id, organizationId, action, notes, { userId });
    return NextResponse.json({ alert });
  } catch (err) {
    return mapAmlError(err, "AML_ALERT_PATCH");
  }
}
