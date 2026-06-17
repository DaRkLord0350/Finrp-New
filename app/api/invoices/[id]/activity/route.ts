// ============================================================
// GET /api/invoices/[id]/activity — invoice activity timeline
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { listInvoiceActivity } from "@/lib/invoices/activity";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Scope check: the invoice must belong to the tenant.
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const activities = await listInvoiceActivity(id, organizationId);
    return NextResponse.json({ activities });
  } catch (error) {
    console.error("[INVOICE_ACTIVITY_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
