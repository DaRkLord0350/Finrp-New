import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const bankAccountId = searchParams.get("bankAccountId");
  const status = searchParams.get("status");
  const reconcileStatus = searchParams.get("reconcileStatus");
  const category = searchParams.get("category");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("q");

  // Server-side sorting (whitelisted columns only). A trailing createdAt key
  // keeps ordering stable when the primary key ties (e.g. many rows share the
  // same transactionDate after a statement import).
  const sortDir: "asc" | "desc" = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const orderBy = (() => {
    switch (searchParams.get("sortBy")) {
      case "credit": return [{ credit: sortDir }, { createdAt: "desc" as const }];
      case "debit": return [{ debit: sortDir }, { createdAt: "desc" as const }];
      case "balance": return [{ balance: sortDir }, { createdAt: "desc" as const }];
      case "createdAt": return [{ createdAt: sortDir }];
      default: return [{ transactionDate: sortDir }, { createdAt: "desc" as const }];
    }
  })();

  const where: Record<string, unknown> = { organizationId: orgId };
  if (bankAccountId) where.bankAccountId = bankAccountId;
  if (status) where.status = status;
  if (reconcileStatus) where.reconcileStatus = reconcileStatus;
  if (category) where.category = category;
  if (from || to) {
    where.transactionDate = {};
    if (from) (where.transactionDate as Record<string, unknown>).gte = new Date(from);
    if (to) (where.transactionDate as Record<string, unknown>).lte = new Date(to);
  }
  if (search) {
    where.OR = [
      { narration: { contains: search, mode: "insensitive" } },
      { referenceNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const [transactions, total] = await Promise.all([
    prisma.bankTransaction.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        bankAccount: { select: { bankName: true, accountNumber: true } },
      },
    }),
    prisma.bankTransaction.count({ where }),
  ]);

  return NextResponse.json({ transactions, total, page, limit, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await req.json();
  const { bankAccountId, transactionDate, narration, credit, debit, balance, referenceNumber, txnType, category } = body;

  if (!bankAccountId || !transactionDate || !narration) {
    return NextResponse.json({ error: "bankAccountId, transactionDate, narration required" }, { status: 400 });
  }

  const txn = await prisma.bankTransaction.create({
    data: {
      organizationId: orgId,
      bankAccountId,
      transactionDate: new Date(transactionDate),
      narration,
      credit: credit ?? null,
      debit: debit ?? null,
      balance: balance ?? null,
      referenceNumber: referenceNumber ?? null,
      txnType: txnType ?? "UNKNOWN",
      category: category ?? null,
      source: "MANUAL",
    },
  });

  return NextResponse.json({ transaction: txn }, { status: 201 });
}
