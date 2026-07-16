import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapFraudError } from "@/lib/fraud/http";
import { listEntries, addListEntry } from "@/lib/fraud/list-service";
import type { FraudListType } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requireTenant({ permission: "fraud.read" });
    const listType = new URL(req.url).searchParams.get("listType") as FraudListType | null;
    const entries = await listEntries(organizationId, listType ?? undefined);
    return NextResponse.json({ entries });
  } catch (err) {
    return mapFraudError(err, "FRAUD_LISTS_GET");
  }
}

export async function POST(req: Request) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "fraud.manage" });
    const body = await req.json();
    const entry = await addListEntry(organizationId, body, { userId });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return mapFraudError(err, "FRAUD_LISTS_POST");
  }
}
