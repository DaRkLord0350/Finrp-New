import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { createRuleSchema } from "@/lib/banking/validations";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { id } = await params;
  const rule = await prisma.bankingRule.findFirst({ where: { id, organizationId: orgId } });
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  return NextResponse.json({ rule });
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

  const existing = await prisma.bankingRule.findFirst({ where: { id, organizationId: orgId } });
  if (!existing) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  if (existing.isSystem) return NextResponse.json({ error: "Cannot modify system rules" }, { status: 403 });

  const body = await req.json();
  const parsed = createRuleSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", issues: parsed.error.issues }, { status: 422 });
  }

  const rule = await prisma.bankingRule.update({
    where: { id },
    data: parsed.data as never,
  });

  return NextResponse.json({ rule });
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

  const existing = await prisma.bankingRule.findFirst({ where: { id, organizationId: orgId } });
  if (!existing) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  if (existing.isSystem) return NextResponse.json({ error: "Cannot delete system rules" }, { status: 403 });

  await prisma.bankingRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
