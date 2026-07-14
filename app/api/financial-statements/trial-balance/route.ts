import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { computeTrialBalance } from "@/lib/financial-statements/computation-engine";

function resolvePeriod(
  preset: string | null,
  start: string | null,
  end: string | null
): { start: Date; end: Date } {
  if (start && end) return { start: new Date(start), end: new Date(end) };
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // Indian fiscal year: Apr-Mar
  const fyStart = month >= 3 ? new Date(year, 3, 1) : new Date(year - 1, 3, 1);
  const fyEnd = month >= 3 ? new Date(year + 1, 2, 31) : new Date(year, 2, 31);
  switch (preset) {
    case "last_year":
      return {
        start: new Date(fyStart.getFullYear() - 1, 3, 1),
        end: new Date(fyStart.getFullYear(), 2, 31),
      };
    default:
      return { start: fyStart, end: fyEnd };
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const sp = req.nextUrl.searchParams;
    const { start, end } = resolvePeriod(
      sp.get("preset"),
      sp.get("periodStart"),
      sp.get("periodEnd")
    );

    const result = await computeTrialBalance(organizationId, start, end);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[financial-statements/trial-balance GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
