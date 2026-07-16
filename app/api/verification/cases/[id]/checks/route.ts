import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapVerificationError } from "@/lib/verification/http";
import * as verification from "@/lib/verification/service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "verification.read" });
    const { id } = await params;
    const checks = await verification.listChecksForCase(id, organizationId);
    return NextResponse.json({ checks });
  } catch (err) {
    return mapVerificationError(err, "VERIFICATION_CHECKS_GET");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "verification.initiate" });
    const { id } = await params;
    const body = await req.json();
    const actor = { userId };

    switch (body.checkType) {
      case "PAN":
        return NextResponse.json({ check: await verification.runPanCheck(id, organizationId, { pan: body.pan, nameToMatch: body.nameToMatch }, actor) }, { status: 201 });
      case "GSTIN":
        return NextResponse.json({ check: await verification.runGstinCheck(id, organizationId, { gstin: body.gstin }, actor) }, { status: 201 });
      case "CIN":
        return NextResponse.json({ check: await verification.runCinCheck(id, organizationId, { cin: body.cin }, actor) }, { status: 201 });
      case "AADHAAR":
        return NextResponse.json(
          { check: await verification.runAadhaarCheck(id, organizationId, { offlineXmlBase64: body.offlineXmlBase64, shareCode: body.shareCode }, actor) },
          { status: 201 }
        );
      case "BANK_ACCOUNT":
        return NextResponse.json(
          {
            check: await verification.runBankAccountCheck(
              id,
              organizationId,
              { accountNumber: body.accountNumber, ifsc: body.ifsc, method: body.method, nameToMatch: body.nameToMatch },
              actor
            ),
          },
          { status: 201 }
        );
      case "DIRECTOR_DIN":
        return NextResponse.json({ check: await verification.runDirectorDinCheck(id, organizationId, { din: body.din }, actor) }, { status: 201 });
      case "CKYC":
        return NextResponse.json({ check: await verification.runCkycCheck(id, organizationId, { pan: body.pan, ckycNumber: body.ckycNumber }, actor) }, { status: 201 });
      case "IFSC":
        return NextResponse.json({ check: await verification.runIfscCheck(id, organizationId, { ifsc: body.ifsc }, actor) }, { status: 201 });
      case "DRIVING_LICENSE":
      case "PASSPORT":
      case "VOTER_ID":
        return NextResponse.json(
          {
            check: await verification.runIdentityDocumentCheck(
              id,
              organizationId,
              { documentType: body.checkType, documentNumber: body.documentNumber, nameToMatch: body.nameToMatch, dob: body.dob },
              actor
            ),
          },
          { status: 201 }
        );
      case "ADDRESS":
        if (!Array.isArray(body.sources)) return NextResponse.json({ error: "sources must be an array of { source, address }" }, { status: 400 });
        return NextResponse.json({ check: await verification.runAddressCrossCheck(id, organizationId, body.sources, actor) }, { status: 201 });
      case "PHONE":
        if (!body.phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });
        return NextResponse.json({ check: await verification.sendPhoneOtp(id, organizationId, { phone: body.phone }, actor) }, { status: 201 });
      case "EMAIL":
        if (!body.email) return NextResponse.json({ error: "email is required" }, { status: 400 });
        return NextResponse.json({ check: await verification.sendEmailOtp(id, organizationId, { email: body.email }, actor) }, { status: 201 });
      case "EMPLOYMENT":
      case "EDUCATION":
      case "REFERENCE":
        if (body.outcome !== "VERIFIED" && body.outcome !== "FAILED") {
          return NextResponse.json({ error: "outcome must be 'VERIFIED' or 'FAILED'" }, { status: 400 });
        }
        return NextResponse.json(
          { check: await verification.recordManualCheck(id, organizationId, { checkType: body.checkType, outcome: body.outcome, notes: body.notes }, actor) },
          { status: 201 }
        );
      default:
        return NextResponse.json({ error: `Unsupported checkType "${body.checkType}"` }, { status: 400 });
    }
  } catch (err) {
    return mapVerificationError(err, "VERIFICATION_CHECKS_POST");
  }
}
