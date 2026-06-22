// ============================================================
// /api/tax/gst/gstr2b
// POST — import GSTR-2B records (provider fetch OR uploaded file)
// GET  — list imported 2B records for a period
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { prisma } from "@/lib/prisma";
import { parseCsv, parseExcel, parseJson } from "@/lib/tax/import/adapters";
import { importGstr2bRecords, normalize2bRows } from "@/lib/tax/gst/gstr2b";
import { getPrimaryGstin } from "@/lib/tax/gst/service";
import { getFilingProvider } from "@/lib/tax/filing/factory";
import { taxAudit } from "@/lib/tax/core/audit";
import type { RawRow } from "@/lib/tax/import/types";

export const GET = withTenant(async (req, { organizationId }) => {
  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? undefined;
  const records = await prisma.gstr2bRecord.findMany({
    where: { organizationId, ...(period ? { period } : {}) },
    orderBy: { invoiceDate: "desc" },
    take: 500,
  });
  return NextResponse.json({ records });
}, { permission: "tax.read" });

const ImportSchema = z.object({
  period: z.string().regex(/^\d{6}$/),
  gstin: z.string().length(15).optional(),
  format: z.enum(["fetch", "csv", "excel", "json"]),
  content: z.string().optional(),
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const body = await req.json().catch(() => null);
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { period, format, content, rows } = parsed.data;
  const gstin = parsed.data.gstin ?? (await getPrimaryGstin(organizationId));
  if (!gstin) return NextResponse.json({ error: "No GST profile found" }, { status: 400 });

  let normalizedRows;
  let source: "GSP" | "CSV" | "EXCEL" | "JSON" = "GSP";
  try {
    if (format === "fetch") {
      const provider = getFilingProvider();
      const res = await provider.fetch2B({ gstin, period });
      normalizedRows = res.records;
      source = "GSP";
    } else {
      let raw: RawRow[];
      if (format === "csv") raw = parseCsv(content ?? "").rows;
      else if (format === "excel") raw = parseExcel(Buffer.from(content ?? "", "base64")).rows;
      else raw = rows ?? parseJson(content ?? "[]").rows;
      normalizedRows = normalize2bRows(raw);
      source = format.toUpperCase() as "CSV" | "EXCEL" | "JSON";
    }
  } catch (err) {
    return NextResponse.json({ error: `2B import failed: ${(err as Error).message}` }, { status: 400 });
  }

  const result = await importGstr2bRecords({ organizationId, gstin, period, rows: normalizedRows, source });

  await taxAudit({
    organizationId,
    userId,
    action: "IMPORT",
    entity: "tax.gst.gstr2b",
    description: `Imported ${result.count} GSTR-2B records for ${period} (${source})`,
  });

  return NextResponse.json(result, { status: 201 });
}, { permission: "tax.write" });
