import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "funding";

    const invoices = await prisma.tredsInvoice.findMany({
      where: { organizationId: tenantId },
      include: { bids: true, settlement: true },
      orderBy: { createdAt: "desc" },
    });

    if (type === "funding") {
      const rows = invoices
        .filter((i) => i.fundingAmount !== null)
        .map((i) => ({
          invoiceNumber: i.invoiceNumber,
          buyerName: i.buyerName,
          invoiceAmount: Number(i.invoiceAmount),
          fundingAmount: Number(i.fundingAmount ?? 0),
          financierName: i.financierName ?? "—",
          financingRate: i.financingRate !== null ? Number(i.financingRate) : null,
          fundedAt: i.fundedAt?.toISOString() ?? null,
          status: i.status,
        }));
      return NextResponse.json({ type, rows, total: rows.length });
    }

    if (type === "aging") {
      const now = new Date();
      const rows = invoices
        .filter((i) => !["SETTLED", "REJECTED"].includes(i.status))
        .map((i) => {
          const days = Math.ceil((now.getTime() - new Date(i.dueDate).getTime()) / 86400000);
          return {
            invoiceNumber: i.invoiceNumber,
            buyerName: i.buyerName,
            invoiceAmount: Number(i.invoiceAmount),
            dueDate: i.dueDate.toISOString(),
            daysOverdue: Math.max(0, days),
            status: i.status,
          };
        })
        .sort((a, b) => b.daysOverdue - a.daysOverdue);
      return NextResponse.json({ type, rows, total: rows.length });
    }

    if (type === "buyer") {
      const buyerMap = new Map<string, { total: number; approved: number; rejected: number; totalDays: number; count: number }>();
      for (const inv of invoices) {
        const b = buyerMap.get(inv.buyerName) ?? { total: 0, approved: 0, rejected: 0, totalDays: 0, count: 0 };
        b.total++;
        if (inv.status === "BUYER_APPROVED" || inv.approvedAt) {
          b.approved++;
          if (inv.submittedAt && inv.approvedAt) {
            b.totalDays += Math.ceil((new Date(inv.approvedAt).getTime() - new Date(inv.submittedAt).getTime()) / 86400000);
            b.count++;
          }
        }
        if (inv.status === "REJECTED") b.rejected++;
        buyerMap.set(inv.buyerName, b);
      }
      const rows = Array.from(buyerMap.entries()).map(([name, v]) => ({
        buyerName: name,
        totalInvoices: v.total,
        approved: v.approved,
        rejected: v.rejected,
        pending: v.total - v.approved - v.rejected,
        avgApprovalDays: v.count > 0 ? Math.round(v.totalDays / v.count) : null,
      }));
      return NextResponse.json({ type, rows, total: rows.length });
    }

    if (type === "financier") {
      const fMap = new Map<string, { bids: number; accepted: number; totalAmount: number; rateSum: number }>();
      for (const inv of invoices) {
        if (!inv.financierName) continue;
        const f = fMap.get(inv.financierName) ?? { bids: 0, accepted: 0, totalAmount: 0, rateSum: 0 };
        f.bids++;
        if (inv.status !== "REJECTED") {
          f.accepted++;
          f.totalAmount += Number(inv.fundingAmount ?? 0);
          f.rateSum += Number(inv.financingRate ?? 0);
        }
        fMap.set(inv.financierName, f);
      }
      const rows = Array.from(fMap.entries()).map(([name, v]) => ({
        financierName: name,
        totalBids: v.bids,
        acceptedBids: v.accepted,
        totalFunded: v.totalAmount,
        avgRate: v.accepted > 0 ? Math.round((v.rateSum / v.accepted) * 100) / 100 : null,
      }));
      return NextResponse.json({ type, rows, total: rows.length });
    }

    return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  } catch (error) {
    console.error("[TREDS_REPORTS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
