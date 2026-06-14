// ============================================================
// GET /api/chart-of-accounts/export
// Streams the (filtered) Chart of Accounts as CSV.
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { accountRepository } from "@/lib/repositories/account.repository";
import { createAuditLog } from "@/lib/audit";
import { ExportAccountsQuerySchema } from "@/lib/validators/chart-of-accounts";

const CSV_HEADERS = [
  "Code", "Account Name", "Type", "Subtype", "Parent Account",
  "Opening Balance", "Current Balance", "Status", "System Generated",
];

function csvEscape(value: string | number | boolean | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const GET = withAuth(async (req, { user, organizationId }) => {
  const url = new URL(req.url);
  const parsed = ExportAccountsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { q, type, status } = parsed.data;

  const { data } = await accountRepository.list(organizationId, {
    q, type, status,
    sortBy: "code",
    sortDir: "asc",
    page: 1,
    pageSize: 10_000,
  });

  const rows = data.map((a) => [
    a.code,
    a.name,
    a.type,
    a.accountSubType ?? "",
    a.parentAccount ? `${a.parentAccount.code} — ${a.parentAccount.name}` : "",
    Number(a.openingBalance).toFixed(2),
    Number(a.balance).toFixed(2),
    a.isActive ? "Active" : "Inactive",
    a.isSystemGenerated ? "Yes" : "No",
  ]);

  const csv = [CSV_HEADERS, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");

  await createAuditLog({
    organizationId,
    userId: user.id,
    action: "EXPORT",
    entity: "account",
    description: `Exported ${rows.length} chart of accounts record(s) to CSV`,
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="chart-of-accounts-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}, "accounting.export");
