// ============================================================
// /api/chart-of-accounts
// GET  — server-side paginated/filtered/sorted list
//        ?view=tree      → full hierarchy (AccountTreeNode[])
//        ?view=options   → lightweight list for dropdowns
// POST — create account
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { accountingService, AccountingError } from "@/lib/services/accounting.service";
import { accountRepository } from "@/lib/repositories/account.repository";
import { CreateAccountSchema, ListAccountsQuerySchema } from "@/lib/validators/chart-of-accounts";

export const GET = withAuth(async (req, { organizationId }) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view");

  if (view === "tree") {
    const tree = await accountingService.getAccountTree(organizationId);
    return NextResponse.json({ tree });
  }

  if (view === "options") {
    const accounts = await accountRepository.listForSelect(organizationId, {
      activeOnly: url.searchParams.get("activeOnly") !== "false",
    });
    return NextResponse.json({ accounts });
  }

  const parsed = ListAccountsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = await accountingService.list(organizationId, parsed.data);
  return NextResponse.json(result);
}, "accounting.read");

export const POST = withAuth(async (req, { user, organizationId }) => {
  const body = await req.json().catch(() => null);
  const parsed = CreateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const account = await accountingService.createAccount(organizationId, { userId: user.id }, parsed.data);
    return NextResponse.json(account, { status: 201 });
  } catch (err) {
    if (err instanceof AccountingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}, "accounting.write");
