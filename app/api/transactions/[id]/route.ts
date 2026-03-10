// ============================================================
// DELETE /api/transactions/[id]
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deleteTransaction } from "@/services/transactionService";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = orgId ?? userId;
    const { id } = await params;
    await deleteTransaction(id, tenantId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/transactions/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
