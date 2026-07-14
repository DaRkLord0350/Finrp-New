import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { tbxLogRepository } from "@/lib/repositories/tbx-log.repository";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser().catch(() => null);
    if (!user || user.userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const apiName = searchParams.get("apiName") ?? undefined;
    const successParam = searchParams.get("success");

    const logs = await tbxLogRepository.list({
      page,
      apiName,
      success: successParam === null ? undefined : successParam === "true",
    });
    return NextResponse.json(logs);
  } catch (error) {
    console.error("[ADMIN_TBX_LOGS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
