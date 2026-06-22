// /api/tax/audit/[id]/approve — sign-off (UDIN) — requires tax.approve
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/lib/auth/require-tenant";
import { approveAuditReport } from "@/lib/tax/audit/service";
import { taxAudit } from "@/lib/tax/core/audit";
import { mapTaxError } from "@/lib/tax/http";

const Schema = z.object({ udin: z.string().min(6) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId } = await requireTenant({ permission: "tax.approve" });
    const { id } = await params;
    const parsed = Schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "UDIN is required" }, { status: 400 });
    const report = await approveAuditReport({ organizationId, id, udin: parsed.data.udin });
    await taxAudit({ organizationId, userId, action: "UPDATE", entity: "tax.audit.report.signed", entityId: id, description: `Signed ${report.formType} with UDIN` });
    return NextResponse.json({ report });
  } catch (err) {
    return mapTaxError(err, "AUDIT_APPROVE");
  }
}
