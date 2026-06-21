import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { runInsightGeneration, generateAIInsightText } from "@/lib/banking/insight-generator";
import { featureGate } from "@/lib/billing/guards";
import { FEATURES } from "@/lib/billing/features";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const insightType = searchParams.get("type");

  const insights = await prisma.bankAIInsight.findMany({
    where: {
      organizationId: orgId,
      isDismissed: false,
      ...(unreadOnly ? { isRead: false } : {}),
      ...(insightType ? { insightType: insightType as never } : {}),
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 20,
  });

  return NextResponse.json({ insights });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { id, action } = await req.json();
  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  const data = action === "dismiss" ? { isDismissed: true } : { isRead: true };

  const insight = await prisma.bankAIInsight.updateMany({
    where: { id, organizationId: orgId },
    data,
  });

  return NextResponse.json({ updated: insight.count });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  // Premium gate: AI generation requires Connected Plus / Standalone.
  const locked = await featureGate(FEATURES.AI);
  if (locked) return locked;

  try {
    const body = await req.json();
    const { action, question } = body;

    if (action === "regenerate") {
      await runInsightGeneration(orgId);
      return NextResponse.json({ success: true });
    }

    if (action === "ask" && question) {
      const answer = await generateAIInsightText(orgId, question);
      return NextResponse.json({ answer });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "insights-post" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
