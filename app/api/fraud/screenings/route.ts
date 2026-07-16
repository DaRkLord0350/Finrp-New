import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapFraudError } from "@/lib/fraud/http";
import { screenApplication, getFraudScoreHistory } from "@/lib/fraud/service";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requireTenant({ permission: "fraud.read" });
    const sp = new URL(req.url).searchParams;
    const subjectType = sp.get("subjectType");
    const subjectId = sp.get("subjectId");
    if (!subjectType || !subjectId) return NextResponse.json({ error: "subjectType and subjectId are required" }, { status: 400 });
    const scores = await getFraudScoreHistory(organizationId, subjectType, subjectId);
    return NextResponse.json({ scores });
  } catch (err) {
    return mapFraudError(err, "FRAUD_SCREENINGS_GET");
  }
}

export async function POST(req: Request) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "fraud.screen" });
    const body = await req.json();
    const result = await screenApplication(organizationId, body, { userId, role });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return mapFraudError(err, "FRAUD_SCREENINGS_POST");
  }
}
