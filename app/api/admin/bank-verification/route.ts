import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { adminKycService } from "@/lib/services/admin-kyc.service";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser().catch(() => null);
    if (!user || user.userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const queue = await adminKycService.listBankVerificationQueue(page);
    return NextResponse.json(queue);
  } catch (error) {
    console.error("[ADMIN_BANK_VERIFICATION_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
