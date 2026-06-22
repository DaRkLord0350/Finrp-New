// /api/tax/capital-gains/import — broker CSV import
import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/require-tenant";
import { parseCsv, parseExcel } from "@/lib/tax/import/adapters";
import { normalizeBrokerRows, createCapitalGainTxn } from "@/lib/tax/capital-gains/service";
import { taxAudit } from "@/lib/tax/core/audit";

const Schema = z.object({
  format: z.enum(["csv", "excel"]),
  content: z.string(),
});

export const POST = withTenant(async (req, { organizationId, userId }) => {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  let rows;
  try {
    rows = parsed.data.format === "csv" ? parseCsv(parsed.data.content).rows : parseExcel(Buffer.from(parsed.data.content, "base64")).rows;
  } catch (err) {
    return NextResponse.json({ error: `Parse failed: ${(err as Error).message}` }, { status: 400 });
  }
  const broker = normalizeBrokerRows(rows);
  let created = 0;
  for (const t of broker) {
    try { await createCapitalGainTxn({ organizationId, createdById: userId, ...t }); created++; } catch { /* skip bad row */ }
  }
  await taxAudit({ organizationId, userId, action: "IMPORT", entity: "tax.capitalgains.import", description: `Imported ${created} capital-gain transactions` });
  return NextResponse.json({ created, parsed: broker.length }, { status: 201 });
}, { permission: "tax.write" });
