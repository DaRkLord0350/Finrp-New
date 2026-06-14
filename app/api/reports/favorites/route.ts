// GET  /api/reports/favorites  — list favorites
// POST /api/reports/favorites  — toggle favorite
import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { getFavorites, toggleFavorite } from "@/lib/reports/service";

export const GET = withTenant(async (_req, { userId, organizationId }) => {
  const favorites = await getFavorites(userId, organizationId);
  return NextResponse.json({ favorites });
});

export const POST = withTenant(async (req, { userId, organizationId }) => {
  const { reportSlug } = await req.json();
  if (!reportSlug) {
    return NextResponse.json({ error: "reportSlug required" }, { status: 400 });
  }
  const result = await toggleFavorite(userId, organizationId, reportSlug);
  return NextResponse.json(result);
});
