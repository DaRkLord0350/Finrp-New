// ============================================================
// GET /api/firm/team/export?format=xlsx|csv
//   Streams the full roster (members + invites) as a spreadsheet.
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import type { FirmMemberRole, Specialization } from "@prisma/client";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { getTeamRoster } from "@/lib/team/queries";
import { buildExportWorkbook } from "@/lib/team/import";
import { FIRM_ROLE_LABELS, SPECIALIZATION_LABELS } from "@/lib/team/constants";

export async function GET(req: NextRequest) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const { members, invites } = await getTeamRoster(admin.organizationId);

  const rows = [...members, ...invites].map((m) => ({
    Name: m.name ?? "",
    Email: m.email,
    Phone: m.phone ?? "",
    Role: m.firmRole ? FIRM_ROLE_LABELS[m.firmRole as FirmMemberRole] : "",
    Specialization: m.specialization
      ? SPECIALIZATION_LABELS[m.specialization as Specialization]
      : "",
    Status: m.status,
    "Joining Date": m.joiningDate ? m.joiningDate.slice(0, 10) : "",
    Customers: m.customerCount,
    "Open Tasks": m.openTaskCount,
  }));

  const buf = buildExportWorkbook(rows, format);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="team-${stamp}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
