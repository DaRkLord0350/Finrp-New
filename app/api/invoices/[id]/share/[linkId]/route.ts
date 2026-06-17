// ============================================================
// PATCH  /api/invoices/[id]/share/[linkId]  — enable/disable a link
// DELETE /api/invoices/[id]/share/[linkId]  — remove a link
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/middleware";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    try {
      await requirePermission("invoices.write");
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, linkId } = await params;
    const body = await req.json().catch(() => ({}));
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive (boolean) is required" }, { status: 400 });
    }

    const updated = await prisma.invoiceShareLink.updateMany({
      where: { id: linkId, invoiceId: id, organizationId },
      data: { isActive: body.isActive },
    });
    if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[INVOICE_SHARE_PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    try {
      await requirePermission("invoices.write");
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, linkId } = await params;
    await prisma.invoiceShareLink.deleteMany({
      where: { id: linkId, invoiceId: id, organizationId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[INVOICE_SHARE_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
