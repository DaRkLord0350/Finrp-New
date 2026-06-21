// ============================================================
// /api/tax/filing
// GET — list filing submissions (filter scheme / period / status)
// ============================================================

import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { prisma } from "@/lib/prisma";
import type { Prisma, TaxFilingStatus, TaxScheme } from "@prisma/client";

export const GET = withTenant(async (req, { organizationId }) => {
  const url = new URL(req.url);
  const scheme = url.searchParams.get("scheme") as TaxScheme | null;
  const period = url.searchParams.get("period");
  const status = url.searchParams.get("status") as TaxFilingStatus | null;

  const where: Prisma.TaxFilingSubmissionWhereInput = {
    organizationId,
    deletedAt: null,
    ...(scheme ? { scheme } : {}),
    ...(period ? { period } : {}),
    ...(status ? { status } : {}),
  };

  const submissions = await prisma.taxFilingSubmission.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ submissions });
}, { permission: "tax.read" });
