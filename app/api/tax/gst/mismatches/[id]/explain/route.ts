// ============================================================
// /api/tax/gst/mismatches/[id]/explain
// POST — AI-explain a reconciliation mismatch (advisory, cached on row)
// ============================================================

import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { prisma } from "@/lib/prisma";
import { explainMismatch } from "@/lib/tax/ai/explain";
import { toNumber } from "@/lib/tax/core/money";

export const POST = withTenant(async (req, { organizationId }) => {
  const id = new URL(req.url).pathname.split("/").slice(-2)[0];
  const m = await prisma.gstMismatch.findFirst({ where: { id, organizationId } });
  if (!m) return NextResponse.json({ error: "Mismatch not found" }, { status: 404 });

  const explanation = await explainMismatch({
    invoiceNumber: m.invoiceNumber,
    supplierGstin: m.supplierGstin,
    outcome: m.outcome,
    kind: m.kind,
    bookTaxable: m.bookTaxable ? toNumber(m.bookTaxable) : null,
    bookTax: m.bookTax ? toNumber(m.bookTax) : null,
    gstr2bTaxable: m.gstr2bTaxable ? toNumber(m.gstr2bTaxable) : null,
    gstr2bTax: m.gstr2bTax ? toNumber(m.gstr2bTax) : null,
    difference: m.difference ? toNumber(m.difference) : null,
  });

  await prisma.gstMismatch.update({ where: { id: m.id }, data: { aiExplanation: explanation } });
  return NextResponse.json({ explanation });
}, { permission: "tax.read" });
