import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapCreditError } from "@/lib/credit/http";
import { getCreditHistory } from "@/lib/credit/comparison";

export async function GET(_req: Request, { params }: { params: Promise<{ subjectType: string; subjectId: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "credit.read" });
    const { subjectType, subjectId } = await params;
    const result = await getCreditHistory(organizationId, subjectType.toUpperCase(), subjectId);
    return NextResponse.json(result);
  } catch (err) {
    return mapCreditError(err, "CREDIT_SUBJECT_HISTORY");
  }
}
