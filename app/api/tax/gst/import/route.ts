// ============================================================
// /api/tax/gst/import
// POST — import GST invoices from CSV / Excel / JSON / Tally XML /
//        manual rows. Raw rows are preserved (TaxImportRecord.raw).
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { parseCsv, parseExcel, parseJson, parseTallyXml, parseManual } from "@/lib/tax/import/adapters";
import { importGstInvoices } from "@/lib/tax/gst/ingest";
import { getPrimaryGstin } from "@/lib/tax/gst/service";
import type { RawRow } from "@/lib/tax/import/types";
import type { TaxImportSource } from "@prisma/client";

const ImportSchema = z.object({
  format: z.enum(["csv", "excel", "json", "tally", "manual"]),
  direction: z.enum(["OUTWARD", "INWARD"]),
  gstin: z.string().length(15).optional(),
  fileName: z.string().optional(),
  /** Text content for csv/json/tally, base64 for excel. */
  content: z.string().optional(),
  /** Pre-structured rows for manual/json. */
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
});

const SOURCE_MAP: Record<string, TaxImportSource> = {
  csv: "CSV",
  excel: "EXCEL",
  json: "JSON",
  tally: "TALLY",
  manual: "MANUAL",
};

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const body = await req.json().catch(() => null);
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { format, direction, content, rows, fileName } = parsed.data;

  const gstin = parsed.data.gstin ?? (await getPrimaryGstin(organizationId));
  if (!gstin) return NextResponse.json({ error: "No GST profile found — add a GSTIN first" }, { status: 400 });

  let parsedRows: RawRow[];
  try {
    switch (format) {
      case "csv":
        if (!content) throw new Error("Missing CSV content");
        parsedRows = parseCsv(content).rows;
        break;
      case "excel":
        if (!content) throw new Error("Missing Excel content (base64)");
        parsedRows = parseExcel(Buffer.from(content, "base64")).rows;
        break;
      case "json":
        parsedRows = rows ?? parseJson(content ?? "[]").rows;
        break;
      case "tally":
        if (!content) throw new Error("Missing Tally XML content");
        parsedRows = parseTallyXml(content).rows;
        break;
      case "manual":
        parsedRows = parseManual(rows ?? []).rows;
        break;
      default:
        throw new Error("Unsupported format");
    }
  } catch (err) {
    return NextResponse.json({ error: `Parse failed: ${(err as Error).message}` }, { status: 400 });
  }

  if (parsedRows.length === 0) {
    return NextResponse.json({ error: "No rows found in the source" }, { status: 400 });
  }

  const result = await importGstInvoices({
    organizationId,
    gstin,
    direction,
    source: SOURCE_MAP[format],
    fileName,
    rows: parsedRows,
    rawPayload: parsedRows.slice(0, 2000),
    createdById: userId,
  });

  return NextResponse.json(result, { status: 201 });
}, { permission: "tax.write" });
