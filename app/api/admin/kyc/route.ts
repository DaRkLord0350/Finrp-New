import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { adminKycService } from "@/lib/services/admin-kyc.service";
import type { KycStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser().catch(() => null);
    if (!user || user.userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as KycStatus | null;
    const page = Number(searchParams.get("page") ?? "1");

    const [queue, counts] = await Promise.all([
      adminKycService.listKycQueue(status ?? undefined, page),
      adminKycService.kycCounts(),
    ]);

    return NextResponse.json({ ...queue, counts });
  } catch (error) {
    console.error("[ADMIN_KYC_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
