// ============================================================
// /api/tax/filing/[id]
// GET — one submission + its immutable filing log history
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { prisma } from "@/lib/prisma";
import { getFilingHistory } from "@/lib/tax/filing/service";
import { mapTaxError } from "@/lib/tax/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "tax.read" });
    const { id } = await params;
    const submission = await prisma.taxFilingSubmission.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const history = await getFilingHistory(id, organizationId);
    return NextResponse.json({ submission, history });
  } catch (err) {
    return mapTaxError(err, "FILING_GET");
  }
}
