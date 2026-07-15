import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { createBankAccountSchema } from "@/lib/banking/validations";
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

  const account = await prisma.bankAccount.findFirst({
    where: { id, organizationId: orgId, deletedAt: null },
    include: {
      connection: true,
      _count: { select: { bankTransactions: true } },
    },
  });

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  return NextResponse.json({ account });
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
    const existing = await prisma.bankAccount.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const body = await req.json();
    const parsed = createBankAccountSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues }, { status: 422 });
    }

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: parsed.data as never,
    });

    await createAuditLog({
      organizationId: orgId,
      userId,
      action: "UPDATE",
      entity: "BankAccount",
      entityId: id,
      description: `Updated bank account: ${updated.accountName}`,
    });

    return NextResponse.json({ account: updated });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "update-account" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

  const account = await prisma.bankAccount.findFirst({
    where: { id, organizationId: orgId, deletedAt: null },
    select: { accountName: true, _count: { select: { bankTransactions: true } } },
  });

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  // Soft delete
  await prisma.bankAccount.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await createAuditLog({
    organizationId: orgId,
    userId,
    action: "DELETE",
    entity: "BankAccount",
    entityId: id,
    description: `Archived bank account: ${account.accountName}`,
  });

  return NextResponse.json({ success: true });
}
