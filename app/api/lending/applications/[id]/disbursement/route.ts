import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { initiateDisbursement, listDisbursements } from "@/lib/lending/disbursement";
import { checkRateLimit } from "@/lib/api/rate-limit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { id } = await params;
    const disbursements = await listDisbursements(id, organizationId);
    return NextResponse.json({ disbursements });
  } catch (err) {
    return mapLendingError(err, "LENDING_DISBURSEMENT_GET");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "lending.disburse" });

    const rate = await checkRateLimit(`lending:disburse:${organizationId}`, 20, 60);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Too many disbursement requests — please slow down" }, { status: 429 });
    }

    const { id } = await params;
    const body = await req.json();
    const disbursement = await initiateDisbursement(id, organizationId, body, { userId, role });
    return NextResponse.json({ disbursement }, { status: 201 });
  } catch (err) {
    return mapLendingError(err, "LENDING_DISBURSEMENT_POST");
  }
}
