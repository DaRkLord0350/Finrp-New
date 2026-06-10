import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const accounts = await prisma.bankAccount.findMany({
    where: { organizationId: orgId, deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { bankName: "asc" }],
    include: {
      consents: { where: { status: "ACTIVE" }, take: 1, select: { status: true, endDate: true } },
      connection: { select: { provider: true, status: true } },
      _count: { select: { bankTransactions: true } },
    },
  });

  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await req.json();
  const { accountName, bankName, accountNumber, ifscCode, accountType, openingBalance, currency, isPrimary, branchName, notes } = body;

  if (!accountName || !bankName || !accountNumber) {
    return NextResponse.json({ error: "accountName, bankName, accountNumber are required" }, { status: 400 });
  }

  const account = await prisma.bankAccount.create({
    data: {
      organizationId: orgId,
      accountName,
      bankName,
      bankCode: ifscCode?.slice(0, 4) ?? null,
      accountNumber,
      maskedNumber: `XXXX XXXX ${accountNumber.slice(-4)}`,
      ifscCode: ifscCode ?? null,
      accountType: accountType ?? "CURRENT",
      openingBalance: openingBalance ?? 0,
      currentBalance: openingBalance ?? 0,
      availableBalance: openingBalance ?? 0,
      currency: currency ?? "INR",
      isPrimary: isPrimary ?? false,
      branchName: branchName ?? null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json({ account }, { status: 201 });
}
