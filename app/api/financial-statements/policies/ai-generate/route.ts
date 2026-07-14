import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { upsertPolicy } from "@/lib/financial-statements/service";
import { generateAccountingPolicies } from "@/lib/financial-statements/ai-mapping";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body?.businessType || !body?.industry) {
      return NextResponse.json({ error: "Missing required fields: businessType, industry" }, { status: 400 });
    }

    const accounts = await prisma.account.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
      select: { name: true },
    });
    const accountNames = accounts.map((a) => a.name);

    const generated = await generateAccountingPolicies(body.businessType, body.industry, accountNames);

    const saved = await Promise.all(
      generated.map((p) =>
        upsertPolicy({
          organizationId,
          policyKey: p.policyKey,
          title: p.title,
          content: p.content,
          isAiGenerated: true,
        })
      )
    );

    return NextResponse.json({ policies: saved });
  } catch (err) {
    console.error("[financial-statements/policies/ai-generate POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

