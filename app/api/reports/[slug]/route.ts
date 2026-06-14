// GET /api/reports/[slug]?preset=this_month&...
// Single endpoint for all 13 report types via slug routing
import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { parseFiltersFromQuery } from "@/lib/reports/filters";
import { runReport } from "@/lib/reports/service";
import { getReport } from "@/lib/reports/registry";

export const GET = withTenant(
  async (req, { organizationId }) => {
    const url  = new URL(req.url);
    const slug = url.pathname.split("/").at(-1) ?? "";

    const definition = getReport(slug);
    if (!definition) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    if (!definition.enabled) {
      return NextResponse.json({ error: "Report not available" }, { status: 403 });
    }

    const filters   = parseFiltersFromQuery(url.searchParams);
    const noCache   = url.searchParams.get("noCache") === "1";
    const result    = await runReport(slug, organizationId, filters, !noCache);

    return NextResponse.json(result);
  }
);
