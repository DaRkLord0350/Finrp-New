// Consolidated endpoint for the linear pipeline checkpoints that don't
// need their own dedicated business logic beyond "mark this checkpoint
// done and move to the next stage" — Document Collection, Verification,
// Credit Bureau, AML, Fraud. Each dispatches to the matching
// lib/lending/workflow/service.ts complete* transition.
import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import * as workflow from "@/lib/lending/workflow/service";

type AdvanceParams = { applicationId: string; organizationId: string; actor: workflow.LoanActor; detail?: string };
const HANDLERS: Record<string, (params: AdvanceParams) => Promise<unknown>> = {
  DOCUMENT_COLLECTION: workflow.completeDocumentCollection,
  VERIFICATION: workflow.completeVerification,
  CREDIT_BUREAU: workflow.completeCreditBureau,
  AML: workflow.completeAmlScreen,
  FRAUD: workflow.completeFraudCheck,
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "lending.write" });
    const { id } = await params;
    const { stage, detail } = await req.json();

    const handler = HANDLERS[stage];
    if (!handler) {
      return NextResponse.json({ error: `Unknown stage "${stage}" — expected one of ${Object.keys(HANDLERS).join(", ")}` }, { status: 400 });
    }
    const application = await handler({ applicationId: id, organizationId, actor: { userId, role }, detail });
    return NextResponse.json({ application });
  } catch (err) {
    return mapLendingError(err, "LENDING_APPLICATION_ADVANCE");
  }
}
