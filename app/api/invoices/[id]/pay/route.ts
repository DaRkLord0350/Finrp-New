import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { logInvoiceActivity } from "@/lib/invoices/activity";

const ZERO = new Prisma.Decimal(0);

class PayError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// POST /api/invoices/[id]/pay — record a payment and deduct inventory stock
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { amount, method = "BANK_TRANSFER", reference, notes } = body;

    // Validate the amount as a precise decimal before touching the DB.
    let paymentAmount: Prisma.Decimal;
    try {
      paymentAmount = new Prisma.Decimal(amount);
    } catch {
      return NextResponse.json({ error: "Valid payment amount is required" }, { status: 400 });
    }
    if (!paymentAmount.isFinite() || paymentAmount.lessThanOrEqualTo(0)) {
      return NextResponse.json({ error: "Valid payment amount is required" }, { status: 400 });
    }

    // Everything runs inside one transaction with the invoice row locked so
    // concurrent payments cannot both read a stale paidAmount and overpay.
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`;

      const invoice = await tx.invoice.findFirst({
        where: { id, organizationId },
        include: { items: true },
      });

      if (!invoice) throw new PayError("Invoice not found", 404);
      if (invoice.status === "CANCELLED") throw new PayError("Cannot pay a cancelled invoice", 400);
      if (invoice.status === "PAID") throw new PayError("Invoice is already fully paid", 400);

      // Decimal money math — never floating point.
      const total = new Prisma.Decimal(invoice.total);
      const currentPaid = new Prisma.Decimal(invoice.paidAmount);
      const newPaidAmount = currentPaid.add(paymentAmount);
      const newBalanceRaw = total.sub(newPaidAmount);
      const newBalance = newBalanceRaw.lessThan(0) ? ZERO : newBalanceRaw;
      const newStatus: "PAID" | "PARTIAL" = newBalance.lessThanOrEqualTo(0) ? "PAID" : "PARTIAL";
      const isFullPayment = newStatus === "PAID";

      // Deduct stock only when the invoice becomes fully paid.
      if (isFullPayment) {
        for (const invoiceItem of invoice.items) {
          if (!invoiceItem.sku) continue;

          const inventoryItem = await tx.item.findFirst({
            where: { sku: invoiceItem.sku, organizationId },
            select: { id: true, stock: true, name: true },
          });
          if (!inventoryItem) continue;

          const qtyToDeduct = Number(invoiceItem.quantity);

          // Prevent negative inventory
          if (inventoryItem.stock < qtyToDeduct) {
            throw new PayError(
              `Insufficient stock for "${inventoryItem.name}". ` +
                `Available: ${inventoryItem.stock}, Required: ${qtyToDeduct}`,
              422
            );
          }

          const beforeStock = inventoryItem.stock;
          const afterStock = beforeStock - qtyToDeduct;

          await tx.item.update({
            where: { id: inventoryItem.id },
            data: { stock: afterStock },
          });

          await tx.transaction.create({
            data: {
              itemId: inventoryItem.id,
              organizationId,
              type: "SALE",
              quantity: qtyToDeduct,
              beforeStock,
              afterStock,
              referenceId: invoice.id,
              note: `Invoice ${invoice.invoiceNumber} paid`,
            },
          });
        }
      }

      // Record the payment
      const payment = await tx.payment.create({
        data: {
          invoiceId: id,
          organizationId,
          amount: paymentAmount,
          method: method as never,
          reference: reference ?? null,
          notes: notes ?? null,
          paidAt: new Date(),
        },
      });

      // Update invoice balances and status
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          balanceDue: newBalance,
          status: newStatus,
        },
        include: {
          customer: { select: { name: true, email: true } },
          items: true,
          payments: true,
        },
      });

      return { payment, invoice: updatedInvoice };
    });

    await logInvoiceActivity({
      invoiceId: id,
      organizationId,
      type: "PAYMENT_RECORDED",
      message: `Payment of ${result.payment.amount.toString()} recorded`,
      metadata: {
        amount: Number(result.payment.amount),
        method: result.payment.method,
        status: result.invoice.status,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PayError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[INVOICE_PAY]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
