// ============================================================
// /api/tax/config
// GET  — list config versions (org-specific + global) for a scheme
// POST — create a DRAFT config override version (tax.manage)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { prisma } from "@/lib/prisma";
import { getDefaultRuleSet, supportedFinancialYears } from "@/lib/tax/config/registry";
import { taxAudit } from "@/lib/tax/core/audit";
import type { Prisma, TaxScheme } from "@prisma/client";

export const GET = withTenant(async (req, { organizationId }) => {
  const url = new URL(req.url);
  const scheme = (url.searchParams.get("scheme") as TaxScheme | null) ?? "GST";
  const period = url.searchParams.get("period") ?? undefined;

  const versions = await prisma.taxConfigVersion.findMany({
    where: {
      scheme,
      deletedAt: null,
      ...(period ? { period } : {}),
      OR: [{ organizationId: null }, { organizationId }],
    },
    orderBy: [{ period: "desc" }, { version: "desc" }],
  });

  return NextResponse.json({
    versions,
    supportedYears: supportedFinancialYears(),
    defaultPack: period ? getDefaultRuleSet(period) : getDefaultRuleSet(supportedFinancialYears().slice(-1)[0]),
  });
}, { permission: "tax.read" });

const CreateSchema = z.object({
  scheme: z.enum(["GST", "TDS", "INCOME_TAX", "AUDIT", "ROC", "DEPRECIATION", "CAPITAL_GAINS", "BUSINESS_INCOME"]),
  period: z.string().min(4),
  label: z.string().optional(),
  notes: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
  global: z.boolean().optional(),
});

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { scheme, period, label, notes, payload, global } = parsed.data;
  const orgScope = global ? null : organizationId;

  // Next version number for this (org, scheme, period).
  const latest = await prisma.taxConfigVersion.findFirst({
    where: { organizationId: orgScope, scheme, period },
    orderBy: { version: "desc" },
  });

  const version = await prisma.taxConfigVersion.create({
    data: {
      organizationId: orgScope,
      scheme,
      period,
      version: (latest?.version ?? 0) + 1,
      status: "DRAFT",
      label,
      notes,
      payload: payload as Prisma.InputJsonValue,
      createdById: userId,
    },
  });

  await taxAudit({
    organizationId,
    userId,
    action: "CREATE",
    entity: "tax.config",
    entityId: version.id,
    description: `Created ${scheme} config draft v${version.version} for ${period}`,
  });

  return NextResponse.json({ version }, { status: 201 });
}, { permission: "tax.manage" });
