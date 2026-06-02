import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = 20;

    const where: Record<string, unknown> = { organizationId: tenantId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { buyerName: { contains: search, mode: "insensitive" } },
        { m1ReferenceId: { contains: search, mode: "insensitive" } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.tredsInvoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tredsInvoice.count({ where }),
    ]);

    return NextResponse.json({
      invoices: invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        buyerName: i.buyerName,
        buyerGstin: i.buyerGstin,
        invoiceAmount: Number(i.invoiceAmount),
        dueDate: i.dueDate.toISOString(),
        status: i.status,
        financierName: i.financierName,
        financingRate: i.financingRate !== null ? Number(i.financingRate) : null,
        fundingAmount: i.fundingAmount !== null ? Number(i.fundingAmount) : null,
        submittedAt: i.submittedAt?.toISOString() ?? null,
        approvedAt: i.approvedAt?.toISOString() ?? null,
        fundedAt: i.fundedAt?.toISOString() ?? null,
        settlementDate: i.settlementDate?.toISOString() ?? null,
        rejectionReason: i.rejectionReason,
        m1ReferenceId: i.m1ReferenceId,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[TREDS_INVOICES_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
