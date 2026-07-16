import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapAmlError } from "@/lib/aml/http";
import { listCases } from "@/lib/aml/case-service";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requireTenant({ permission: "aml.read" });
    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    const cases = await listCases(organizationId, { status });
    return NextResponse.json({ cases });
  } catch (err) {
    return mapAmlError(err, "AML_CASES_GET");
  }
}
