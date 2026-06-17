// ============================================================
// GET /api/invoices/[id]/versions — list version snapshots
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const versions = await prisma.invoiceVersion.findMany({
      where: { invoiceId: id, organizationId },
      orderBy: { version: "desc" },
    });
    return NextResponse.json({ versions });
  } catch (error) {
    console.error("[INVOICE_VERSIONS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
