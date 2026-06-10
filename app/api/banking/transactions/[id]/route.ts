import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { updateTransactionSchema } from "@/lib/banking/validations";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { id } = await params;

  const txn = await prisma.bankTransaction.findFirst({
    where: { id, organizationId: orgId },
    include: {
      bankAccount: { select: { bankName: true, accountNumber: true, accountName: true } },
      reconcileMatches: {
        include: { session: { select: { name: true, status: true } } },
      },
      riskAlerts: { where: { status: "OPEN" } },
    },
  });

  if (!txn) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  return NextResponse.json({ transaction: txn });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues }, { status: 422 });
    }

    const existing = await prisma.bankTransaction.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const updated = await prisma.bankTransaction.update({
      where: { id },
      data: {
        ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
        ...(parsed.data.subCategory !== undefined ? { subCategory: parsed.data.subCategory } : {}),
        ...(parsed.data.txnType !== undefined ? { txnType: parsed.data.txnType as never } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status as never } : {}),
        ...(parsed.data.isIgnored !== undefined ? { isIgnored: parsed.data.isIgnored } : {}),
        ...(parsed.data.isFlagged !== undefined ? { isFlagged: parsed.data.isFlagged } : {}),
        ...(parsed.data.gstCategory !== undefined ? { gstCategory: parsed.data.gstCategory as never } : {}),
        ...(parsed.data.gstin !== undefined ? { gstin: parsed.data.gstin } : {}),
        ...(parsed.data.invoiceRef !== undefined ? { invoiceRef: parsed.data.invoiceRef } : {}),
      },
    });

    await createAuditLog({
      organizationId: orgId,
      userId,
      action: "UPDATE",
      entity: "BankTransaction",
      entityId: id,
      description: `Updated bank transaction: ${existing.narration}`,
      oldValue: { category: existing.category, status: existing.status } as never,
      newValue: { category: updated.category, status: updated.status } as never,
    });

    return NextResponse.json({ transaction: updated });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "update-transaction" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { id } = await params;

  const txn = await prisma.bankTransaction.findFirst({
    where: { id, organizationId: orgId, source: "MANUAL" },
  });

  if (!txn) {
    return NextResponse.json({ error: "Transaction not found or cannot delete non-manual transaction" }, { status: 404 });
  }

  await prisma.bankTransaction.delete({ where: { id } });

  await createAuditLog({
    organizationId: orgId,
    userId,
    action: "DELETE",
    entity: "BankTransaction",
    entityId: id,
    description: `Deleted manual bank transaction: ${txn.narration}`,
  });

  return NextResponse.json({ success: true });
}
