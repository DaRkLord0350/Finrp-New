import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const consolidations = await prisma.branchConsolidation.findMany({
      where: { parentOrganizationId: organizationId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(consolidations);
  } catch (err) {
    console.error("[financial-statements/consolidation GET]", err);
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
    if (
      !Array.isArray(body?.childOrganizationIds) ||
      !body?.statementType ||
      !body?.periodStart ||
      !body?.periodEnd
    ) {
      return NextResponse.json(
        { error: "Missing required fields: childOrganizationIds, statementType, periodStart, periodEnd" },
        { status: 400 }
      );
    }

    const consolidation = await prisma.branchConsolidation.create({
      data: {
        parentOrganizationId: organizationId,
        statementType: body.statementType,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        childOrganizationIds: body.childOrganizationIds,
        status: "DRAFT",
        createdById: userId,
      },
    });
    return NextResponse.json(consolidation, { status: 201 });
  } catch (err) {
    console.error("[financial-statements/consolidation POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

