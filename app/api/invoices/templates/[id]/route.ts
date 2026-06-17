// ============================================================
// DELETE /api/invoices/templates/[id]  — remove a saved template
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/middleware";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    try {
      await requirePermission("settings.write");
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await prisma.invoiceTemplate.deleteMany({
      where: { id, organizationId: tenantId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[INVOICE_TEMPLATE_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
