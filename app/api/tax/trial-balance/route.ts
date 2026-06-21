// /api/tax/trial-balance — latest TB + import
import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { parseCsv, parseExcel } from "@/lib/tax/import/adapters";
import { importTrialBalance, getLatestTrialBalance, normalizeTbRows } from "@/lib/tax/financials/service";
import { taxAudit } from "@/lib/tax/core/audit";

export const GET = withTenant(async (req, { organizationId }) => {
  const fy = new URL(req.url).searchParams.get("fy") ?? undefined;
  return NextResponse.json({ trialBalance: await getLatestTrialBalance(organizationId, fy) });
}, { permission: "tax.read" });

const Schema = z.object({
  financialYear: z.string().min(4),
  format: z.enum(["csv", "excel", "manual"]),
  content: z.string().optional(),
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
  fileName: z.string().optional(),
});

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  const { financialYear, format, content, rows, fileName } = parsed.data;
  let raw;
  try {
    if (format === "csv") raw = parseCsv(content ?? "").rows;
    else if (format === "excel") raw = parseExcel(Buffer.from(content ?? "", "base64")).rows;
    else raw = rows ?? [];
  } catch (err) {
    return NextResponse.json({ error: `Parse failed: ${(err as Error).message}` }, { status: 400 });
  }
  const tbRows = normalizeTbRows(raw);
  if (tbRows.length === 0) return NextResponse.json({ error: "No trial-balance rows found" }, { status: 400 });

  const imp = await importTrialBalance({
    organizationId, financialYear, rows: tbRows,
    source: format === "manual" ? "MANUAL" : format === "csv" ? "CSV" : "EXCEL",
    fileName, createdById: userId,
  });
  await taxAudit({ organizationId, userId, action: "IMPORT", entity: "tax.trialbalance", entityId: imp.id, description: `Imported trial balance ${financialYear} (${imp.lineCount} lines, ${imp.balanced ? "balanced" : "UNBALANCED"})` });
  return NextResponse.json({ id: imp.id, lineCount: imp.lineCount, balanced: imp.balanced, totalDebit: imp.totalDebit, totalCredit: imp.totalCredit }, { status: 201 });
}, { permission: "tax.write" });
