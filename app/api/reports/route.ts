// GET /api/reports — report registry + favorites
import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { REPORTS, REPORT_CATEGORIES } from "@/lib/reports/registry";
import { getFavorites } from "@/lib/reports/service";

export const GET = withTenant(async (_req, { userId, organizationId }) => {
  const favorites = await getFavorites(userId, organizationId);
  const favSet    = new Set(favorites);

  const reports = REPORTS.map((r) => ({
    ...r,
    isFavorite: favSet.has(r.slug),
  }));

  return NextResponse.json({ reports, categories: REPORT_CATEGORIES });
});
