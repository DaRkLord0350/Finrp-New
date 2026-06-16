// ============================================================
// GET /api/firm/team/import/template
//   Downloads the sample .xlsx import template (headers + examples).
//
// RBAC: CA_FIRM_ADMIN only.
// ============================================================

import { NextResponse } from "next/server";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { buildSampleTemplate } from "@/lib/team/import";

export async function GET() {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const buf = buildSampleTemplate();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="team-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
