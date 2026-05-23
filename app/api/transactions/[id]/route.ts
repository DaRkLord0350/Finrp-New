// ============================================================
// DELETE /api/transactions/[id]
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deleteTransaction } from "@/services/transactionService";
import { getTenantId } from "@/lib/auth/tenant";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = await getTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await deleteTransaction(id, tenantId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/transactions/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
