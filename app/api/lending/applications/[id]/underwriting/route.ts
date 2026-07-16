import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { prisma } from "@/lib/prisma";
import { recordUnderwritingDecision } from "@/lib/lending/underwriting";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { id } = await params;
    const decisions = await prisma.loanUnderwritingDecision.findMany({
      where: { applicationId: id, organizationId },
      orderBy: { createdAt: "desc" },
      include: { decidedBy: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ decisions });
  } catch (err) {
    return mapLendingError(err, "LENDING_UNDERWRITING_GET");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "lending.approve" });
    const { id } = await params;
    const body = await req.json();
    const decision = await recordUnderwritingDecision(id, organizationId, body, { userId, role });
    return NextResponse.json({ decision }, { status: 201 });
  } catch (err) {
    return mapLendingError(err, "LENDING_UNDERWRITING_POST");
  }
}
