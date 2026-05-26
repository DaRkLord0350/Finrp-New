// ============================================================
// DELETE /api/transactions/[id]
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { deleteTransaction } from "@/services/transactionService";

export const DELETE = withAuth(async (
  _req: Request,
  { organizationId }
) => {
  try {
    // Extract ID from URL
    const url = new URL(_req.url);
    const id = url.pathname.split("/").pop();
    
    if (!id) {
      return NextResponse.json({ error: "Missing transaction ID" }, { status: 400 });
    }

    await deleteTransaction(id, organizationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/transactions/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "finance.write");
