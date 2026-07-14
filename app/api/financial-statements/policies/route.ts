import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { getPolicies, upsertPolicy } from "@/lib/financial-statements/service";

export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const policies = await getPolicies(organizationId);
    return NextResponse.json(policies);
  } catch (err) {
    console.error("[financial-statements/policies GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body?.policyKey || !body?.title || !body?.content) {
      return NextResponse.json({ error: "Missing required fields: policyKey, title, content" }, { status: 400 });
    }

    const policy = await upsertPolicy({
      organizationId,
      policyKey: body.policyKey,
      title: body.title,
      content: body.content,
      isAiGenerated: body.isAiGenerated,
    });
    return NextResponse.json(policy);
  } catch (err) {
    console.error("[financial-statements/policies POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
