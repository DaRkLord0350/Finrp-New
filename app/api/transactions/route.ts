// ============================================================
// GET  /api/transactions — list all transactions for the org
// POST /api/transactions — create a sale or restock record
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTransactions, createTransaction } from "@/services/transactionService";
import { transactionSchema } from "@/lib/validations";

export async function GET() {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = orgId ?? userId;
    const transactions = await getTransactions(tenantId);
    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("[GET /api/transactions]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = orgId ?? userId;

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
      organizationId: tenantId,
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/transactions]", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
