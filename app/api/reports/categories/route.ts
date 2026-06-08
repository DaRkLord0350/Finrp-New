// GET /api/reports/categories
import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { REPORT_CATEGORIES, REPORTS } from "@/lib/reports/registry";

export const GET = withTenant(async () => {
  const categories = Object.entries(REPORT_CATEGORIES).map(([key, meta]) => ({
    key,
    label: meta.label,
    icon:  meta.icon,
    count: REPORTS.filter((r) => r.category === key && r.enabled).length,
  }));

  return NextResponse.json({ categories });
});
