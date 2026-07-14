import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { getMappings, saveMapping } from "@/lib/financial-statements/service";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const templateId = req.nextUrl.searchParams.get("templateId");
    if (!templateId) {
      return NextResponse.json({ error: "Missing required query param: templateId" }, { status: 400 });
    }

    const mappings = await getMappings(organizationId, templateId);
    return NextResponse.json(mappings);
  } catch (err) {
    console.error("[financial-statements/mappings GET]", err);
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
    if (!body?.accountId || !body?.templateId || !body?.scheduleKey || !body?.scheduleName || !body?.source) {
      return NextResponse.json({ error: "Missing required fields: accountId, templateId, scheduleKey, scheduleName, source" }, { status: 400 });
    }

    const mapping = await saveMapping({
      organizationId,
      accountId: body.accountId,
      templateId: body.templateId,
      scheduleKey: body.scheduleKey,
      scheduleName: body.scheduleName,
      source: body.source,
      confidence: body.confidence,
      aiRationale: body.aiRationale,
    });
    return NextResponse.json(mapping);
  } catch (err) {
    console.error("[financial-statements/mappings POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
