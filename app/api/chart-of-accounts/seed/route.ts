// ============================================================
// POST /api/chart-of-accounts/seed
//
// Retrofits the default system Chart of Accounts onto an
// organization that was provisioned before the COA module
// existed (or whose webhook seeding was missed). Idempotent —
// safe to call repeatedly.
// ============================================================

import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { hasPermission } from "@/lib/auth/check-permission";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { seedSystemAccounts } from "@/lib/accounting/system-accounts";

export const POST = withTenant(async (_req, { organizationId }) => {
  if (!(await hasPermission("accounting.write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await getCurrentUser();

  const seeded = await prisma.$transaction((tx) =>
    seedSystemAccounts(tx, organizationId, user?.id ?? null)
  );

  return NextResponse.json({
    seeded: seeded > 0,
    accountsCreated: seeded,
    message: seeded > 0
      ? `Seeded ${seeded} default accounts.`
      : "System accounts already exist — nothing to do.",
  });
});
