import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapAmlError } from "@/lib/aml/http";
import { runScreening, getScreeningsForSubject } from "@/lib/aml/service";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requireTenant({ permission: "aml.read" });
    const sp = new URL(req.url).searchParams;
    const subjectType = sp.get("subjectType");
    const subjectId = sp.get("subjectId");
    if (!subjectType || !subjectId) return NextResponse.json({ error: "subjectType and subjectId are required" }, { status: 400 });
    const screenings = await getScreeningsForSubject(organizationId, subjectType, subjectId);
    return NextResponse.json({ screenings });
  } catch (err) {
    return mapAmlError(err, "AML_SCREENINGS_GET");
  }
}

export async function POST(req: Request) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "aml.screen" });
    const body = await req.json();
    const result = await runScreening(organizationId, body, { userId, role });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return mapAmlError(err, "AML_SCREENINGS_POST");
  }
}
