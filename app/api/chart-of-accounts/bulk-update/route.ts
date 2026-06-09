// ============================================================
// POST /api/chart-of-accounts/bulk-update
// Bulk activate / deactivate accounts.
// System-generated accounts are skipped, never errored on, so a
// mixed selection still succeeds for the eligible subset.
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { accountingService } from "@/lib/services/accounting.service";
import { BulkUpdateAccountsSchema } from "@/lib/validators/chart-of-accounts";

export const POST = withAuth(async (req, { user, organizationId }) => {
  const body = await req.json().catch(() => null);
  const parsed = BulkUpdateAccountsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { accountIds, action } = parsed.data;
  const result = await accountingService.bulkSetActiveStatus(
    organizationId,
    { userId: user.id },
    accountIds,
    action === "activate"
  );

  return NextResponse.json({
    updated: result.updated,
    skipped: result.skipped,
    message:
      result.skipped > 0
        ? `${result.updated} account(s) updated, ${result.skipped} system-generated account(s) skipped.`
        : `${result.updated} account(s) updated.`,
  });
}, "accounting.write");
