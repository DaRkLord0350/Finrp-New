// GET  /api/reports/scheduled — list scheduled reports for org
// POST /api/reports/scheduled — create a scheduled report
import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateSchema = z.object({
  reportSlug:      z.string().min(1),
  name:            z.string().min(1),
  frequency:       z.enum(["daily", "weekly", "monthly"] as [string, ...string[]]),
  emailRecipients: z.array(z.string().email()).min(1),
  filters:         z.record(z.string(), z.unknown()).optional(),
});

export const GET = withTenant(async (_req, { organizationId }) => {
  const scheduled = await prisma.scheduledReport.findMany({
    where:   { organizationId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ scheduled });
});

export const POST = withTenant(async (req, { userId, organizationId }) => {
  const body   = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { reportSlug, name, frequency, emailRecipients, filters } = parsed.data;

  const nextRunAt = computeNextRun(frequency);

  const scheduled = await prisma.scheduledReport.create({
    data: {
      organizationId,
      reportSlug,
      name,
      frequency,
      emailRecipients,
      filters: (filters ?? {}) as Record<string, string>,
      nextRunAt,
      createdById: userId,
    },
  });

  return NextResponse.json(scheduled, { status: 201 });
});

function computeNextRun(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case "daily":   return new Date(now.getTime() + 24 * 3600_000);
    case "weekly":  return new Date(now.getTime() + 7  * 24 * 3600_000);
    case "monthly": {
      const next = new Date(now);
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      return next;
    }
    default:        return new Date(now.getTime() + 24 * 3600_000);
  }
}
