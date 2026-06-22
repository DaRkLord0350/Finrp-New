// ============================================================
// /api/tax/validation/run
// POST — run the GST validation rule set for a period (no persistence
//        of a filing; returns findings + an AI summary).
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { runGstValidation, getPrimaryGstin } from "@/lib/tax/gst/service";
import { summarizeIssues } from "@/lib/tax/ai/explain";

const RunSchema = z.object({
  scheme: z.enum(["GST"]).default("GST"),
  period: z.string().regex(/^\d{6}$/),
  gstin: z.string().length(15).optional(),
  subjectType: z.string().default("GSTR1"),
  summarize: z.boolean().optional(),
});

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const body = await req.json().catch(() => null);
  const parsed = RunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const gstin = parsed.data.gstin ?? (await getPrimaryGstin(organizationId));
  if (!gstin) return NextResponse.json({ error: "No GST profile found" }, { status: 400 });

  const outcome = await runGstValidation({
    organizationId,
    gstin,
    period: parsed.data.period,
    subjectType: parsed.data.subjectType,
    triggeredById: userId,
  });

  let summary: string | undefined;
  if (parsed.data.summarize) {
    summary = await summarizeIssues(
      outcome.findings.map((f) => ({ ruleCode: f.ruleCode, severity: f.severity, message: f.message }))
    );
  }

  return NextResponse.json({ ...outcome, summary });
}, { permission: "tax.read" });
