import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const bankAccountId = searchParams.get("bankAccountId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format") ?? "csv";
  const category = searchParams.get("category");
  const reconcileStatus = searchParams.get("reconcileStatus");

  try {
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        organizationId: orgId,
        ...(bankAccountId ? { bankAccountId } : {}),
        ...(from || to ? {
          transactionDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        } : {}),
        ...(category ? { category } : {}),
        ...(reconcileStatus ? { reconcileStatus: reconcileStatus as never } : {}),
        isIgnored: false,
      },
      include: {
        bankAccount: { select: { bankName: true, accountNumber: true } },
      },
      orderBy: { transactionDate: "desc" },
      take: 10_000,
    });

    const rows = transactions.map(t => ({
      Date: t.transactionDate.toISOString().slice(0, 10),
      Narration: t.narration,
      Reference: t.referenceNumber ?? "",
      Credit: t.credit ? Number(t.credit).toFixed(2) : "",
      Debit: t.debit ? Number(t.debit).toFixed(2) : "",
      Balance: t.balance ? Number(t.balance).toFixed(2) : "",
      Category: t.category ?? "",
      "Sub Category": t.subCategory ?? "",
      "Txn Type": t.txnType,
      Status: t.status,
      "Reconcile Status": t.reconcileStatus,
      Bank: t.bankAccount.bankName,
      Account: t.bankAccount.accountNumber,
      Tags: t.tags.join(", "),
      Notes: t.notes ?? "",
    }));

    if (format === "xlsx") {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Transactions");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="transactions-${Date.now()}.xlsx"`,
        },
      });
    }

    // Default CSV
    const headers = Object.keys(rows[0] ?? {}).join(",");
    const csvRows = rows.map(r =>
      Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    const csv = [headers, ...csvRows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="transactions-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "export-transactions" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
