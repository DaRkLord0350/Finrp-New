// ============================================================
// /api/chart-of-accounts/:id
// GET    — single account detail (+ live balance/activity)
// PATCH  — update account (subject to system/transaction restrictions)
// DELETE — soft delete (blocked if ledger entries or sub-accounts exist)
// ============================================================

import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { accountingService, AccountingError } from "@/lib/services/accounting.service";
import { UpdateAccountSchema } from "@/lib/validators/chart-of-accounts";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  try {
    const { organizationId } = await requirePermission("accounting.read");
    const { id } = await params;

    const account = await accountingService.getById(organizationId, id);
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const activity = await accountingService.getAccountBalance(organizationId, id).catch(() => null);
    return NextResponse.json({ ...account, activity });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    if (err instanceof AccountingError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[CHART_OF_ACCOUNTS_GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("accounting.write");
    const { id } = await params;

    const body = await req.json().catch(() => null);
    const parsed = UpdateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }

    const account = await accountingService.updateAccount(organizationId, { userId: user.id }, id, parsed.data);
    return NextResponse.json(account);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    if (err instanceof AccountingError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[CHART_OF_ACCOUNTS_PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("accounting.delete");
    const { id } = await params;

    await accountingService.deleteAccount(organizationId, { userId: user.id }, id);
    return NextResponse.json({ message: "Account deactivated" });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    if (err instanceof AccountingError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[CHART_OF_ACCOUNTS_DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
