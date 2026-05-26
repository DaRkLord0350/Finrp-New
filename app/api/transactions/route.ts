// ============================================================
// GET  /api/transactions — list all transactions for the org
// POST /api/transactions — create a sale or restock record
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { getTransactions, createTransaction } from "@/services/transactionService";
import { transactionSchema } from "@/lib/validations";

export const GET = withAuth(async (_req: Request, { organizationId }) => {
  try {
    const transactions = await getTransactions(organizationId);
    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("[GET /api/transactions]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "finance.read");

export const POST = withAuth(async (req: Request, { organizationId }) => {
  try {
    const body = await req.json();
    const parsed = transactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const transaction = await createTransaction({
      ...parsed.data,
      organizationId,
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/transactions]", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}, "finance.write");
