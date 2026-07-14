import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { saveMapping } from "@/lib/financial-statements/service";
import { generateAIMappings } from "@/lib/financial-statements/ai-mapping";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body?.templateId || !body?.templateCategory || !body?.statementType) {
      return NextResponse.json({ error: "Missing required fields: templateId, templateCategory, statementType" }, { status: 400 });
    }

    const accounts = await prisma.account.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
      select: { id: true, code: true, name: true, type: true },
    });

    if (accounts.length === 0) {
      return NextResponse.json({ suggestions: [], saved: 0 });
    }

    const accountInputs = accounts.map((a) => ({
      accountId: a.id,
      code: a.code,
      name: a.name,
      accountType: a.type,
      currentBalance: 0,
    }));

    const suggestions = await generateAIMappings(
      accountInputs,
      body.templateCategory,
      body.statementType
    );

    const validSuggestions = suggestions.filter((s) => s.suggestedKey !== "UNMAPPED");

    await Promise.all(
      validSuggestions.map((s) =>
        saveMapping({
          organizationId,
          accountId: s.accountId,
          templateId: body.templateId,
          scheduleKey: s.suggestedKey,
          scheduleName: s.suggestedName,
          source: "AI_AUTO",
          confidence: s.confidence,
          aiRationale: s.rationale,
        })
      )
    );

    return NextResponse.json({ suggestions, saved: validSuggestions.length });
  } catch (err) {
    console.error("[financial-statements/mappings/ai-suggest POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

