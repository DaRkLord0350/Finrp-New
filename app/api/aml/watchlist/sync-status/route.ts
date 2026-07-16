import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapAmlError } from "@/lib/aml/http";
import { getLastSyncStatus } from "@/lib/aml/sanctions/service";

export async function GET() {
  try {
    await requireTenant({ permission: "aml.read" });
    const status = await getLastSyncStatus();
    return NextResponse.json({ status });
  } catch (err) {
    return mapAmlError(err, "AML_WATCHLIST_SYNC_STATUS");
  }
}
