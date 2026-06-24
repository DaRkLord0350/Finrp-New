// ============================================================
// GET /api/firm/relationships/[caId]
//   → full 360° detail for a single CA (profile, metrics,
//     portfolio, tasks, activity timeline).
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextResponse } from "next/server";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { getCaDetail } from "@/lib/firm/relationships";

export async function GET(_req: Request, { params }: { params: Promise<{ caId: string }> }) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { caId } = await params;
  const detail = await getCaDetail(admin.organizationId, caId);
  if (!detail) return NextResponse.json({ error: "CA not found" }, { status: 404 });

  return NextResponse.json({ detail });
}
