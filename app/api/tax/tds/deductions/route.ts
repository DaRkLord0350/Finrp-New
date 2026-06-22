// /api/tax/tds/deductions — list + create deductions (auto-computes TDS)
import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { prisma } from "@/lib/prisma";
import { createDeduction } from "@/lib/tax/tds/service";

export const GET = withTenant(async (req, { organizationId }) => {
  const url = new URL(req.url);
  const fy = url.searchParams.get("fy") ?? undefined;
  const quarter = url.searchParams.get("quarter") ?? undefined;
  const deductions = await prisma.tdsDeduction.findMany({
    where: { organizationId, ...(fy ? { financialYear: fy } : {}), ...(quarter ? { quarter } : {}) },
    orderBy: { paymentDate: "desc" }, take: 500,
    include: { deductee: { select: { name: true, panMasked: true } } },
  });
  return NextResponse.json({ deductions });
}, { permission: "tax.read" });

const Schema = z.object({
  deducteeId: z.string().min(1),
  challanId: z.string().optional(),
  section: z.string().min(2),
  financialYear: z.string().min(4),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  paymentDate: z.string(),
  amountPaid: z.number(),
  isIndividual: z.boolean().optional(),
  tdsDeducted: z.number().optional(),
});

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const d = await createDeduction({ organizationId, createdById: userId, ...parsed.data });
    return NextResponse.json({ id: d.id, tdsDeducted: d.tdsDeducted, rate: d.tdsRate }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}, { permission: "tax.write" });
