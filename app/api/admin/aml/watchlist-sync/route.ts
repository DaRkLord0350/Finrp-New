// ============================================================
// /api/admin/aml/watchlist-sync — platform-operator manual trigger
// for OFAC/UN sanctions list ingestion. Gated by userRole === "ADMIN",
// mirrors app/api/admin/kyc/route.ts's auth shape. Global data, not
// tenant-scoped — one sync serves every organization.
// ============================================================

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { mapAmlError } from "@/lib/aml/http";
import { syncWatchlist, getLastSyncStatus } from "@/lib/aml/sanctions/service";

export async function GET() {
  try {
    const user = await getCurrentUser().catch(() => null);
    if (!user || user.userRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const status = await getLastSyncStatus();
    return NextResponse.json({ status });
  } catch (err) {
    return mapAmlError(err, "ADMIN_AML_WATCHLIST_SYNC_GET");
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser().catch(() => null);
    if (!user || user.userRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { source } = await req.json();
    if (source !== "OFAC_SDN" && source !== "UN_CONSOLIDATED") {
      return NextResponse.json({ error: "source must be 'OFAC_SDN' or 'UN_CONSOLIDATED'" }, { status: 400 });
    }
    const result = await syncWatchlist(source);
    return NextResponse.json(result);
  } catch (err) {
    return mapAmlError(err, "ADMIN_AML_WATCHLIST_SYNC_POST");
  }
}
