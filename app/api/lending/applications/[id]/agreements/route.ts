import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { prisma } from "@/lib/prisma";
import { createAgreement } from "@/lib/lending/agreements";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { id } = await params;
    const agreements = await prisma.loanAgreement.findMany({
      where: { applicationId: id, organizationId },
      include: { signatories: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ agreements });
  } catch (err) {
    return mapLendingError(err, "LENDING_AGREEMENTS_GET");
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.sanction" });
    const { id } = await params;
    const agreement = await createAgreement(id, organizationId, { userId });
    return NextResponse.json({ agreement }, { status: 201 });
  } catch (err) {
    return mapLendingError(err, "LENDING_AGREEMENTS_POST");
  }
}
