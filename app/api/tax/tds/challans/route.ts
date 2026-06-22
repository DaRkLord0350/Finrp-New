// /api/tax/tds/challans — list + create challans
import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { prisma } from "@/lib/prisma";
import { createChallan } from "@/lib/tax/tds/service";

export const GET = withTenant(async (req, { organizationId }) => {
  const url = new URL(req.url);
  const fy = url.searchParams.get("fy") ?? undefined;
  const quarter = url.searchParams.get("quarter") ?? undefined;
  const challans = await prisma.tdsChallan.findMany({
    where: { organizationId, deletedAt: null, ...(fy ? { financialYear: fy } : {}), ...(quarter ? { quarter } : {}) },
    orderBy: { createdAt: "desc" }, take: 200,
  });
  return NextResponse.json({ challans });
}, { permission: "tax.read" });

const Schema = z.object({
  financialYear: z.string().min(4),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  section: z.string().min(2),
  bsrCode: z.string().optional(),
  challanNo: z.string().optional(),
  depositDate: z.string().optional(),
  tdsAmount: z.number(),
  interest: z.number().optional(),
  fee: z.number().optional(),
});

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  const challan = await createChallan({ organizationId, createdById: userId, ...parsed.data });
  return NextResponse.json({ id: challan.id }, { status: 201 });
}, { permission: "tax.write" });
