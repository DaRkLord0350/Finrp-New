import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapVerificationError } from "@/lib/verification/http";
import { confirmOtp } from "@/lib/verification/service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; checkId: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "verification.initiate" });
    const { id, checkId } = await params;
    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });
    const { check, result } = await confirmOtp(checkId, id, organizationId, { code }, { userId });
    return NextResponse.json({ check, result });
  } catch (err) {
    return mapVerificationError(err, "VERIFICATION_OTP_CONFIRM");
  }
}
