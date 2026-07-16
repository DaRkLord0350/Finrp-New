import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapVerificationError } from "@/lib/verification/http";
import { listCases, findOrCreateOpenCase } from "@/lib/verification/case-service";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requireTenant({ permission: "verification.read" });
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") ?? undefined;
    const subjectType = sp.get("subjectType") ?? undefined;
    const applicationId = sp.get("applicationId") ?? undefined;
    const cases = await listCases(organizationId, { status, subjectType, applicationId });
    return NextResponse.json({ cases });
  } catch (err) {
    return mapVerificationError(err, "VERIFICATION_CASES_GET");
  }
}

export async function POST(req: Request) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "verification.initiate" });
    const body = await req.json();
    if (!body.subjectType || !body.subjectId || !body.subjectName) {
      return NextResponse.json({ error: "subjectType, subjectId, and subjectName are required" }, { status: 400 });
    }
    const kase = await findOrCreateOpenCase(organizationId, body, { userId });
    return NextResponse.json({ case: kase }, { status: 201 });
  } catch (err) {
    return mapVerificationError(err, "VERIFICATION_CASES_POST");
  }
}
