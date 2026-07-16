import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { listCollectionCases, summarizePortfolioByBucket } from "@/lib/lending/collections";
import type { CollectionBucket } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const sp = new URL(req.url).searchParams;
    const cases = await listCollectionCases(organizationId, {
      status: sp.get("status") ?? undefined,
      bucket: (sp.get("bucket") as CollectionBucket) ?? undefined,
      assignedToId: sp.get("assignedToId") ?? undefined,
    });
    const buckets = summarizePortfolioByBucket(cases);
    return NextResponse.json({ cases, buckets });
  } catch (err) {
    return mapLendingError(err, "LENDING_COLLECTIONS_GET");
  }
}
