import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapVerificationError } from "@/lib/verification/http";
import { lookupIfsc } from "@/lib/verification/ifsc/service";

/** Standalone IFSC lookup — not tied to a case, backs the IFSC Lookup Tool page. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    await requireTenant({ permission: "verification.read" });
    const { code } = await params;
    const result = await lookupIfsc(code);
    return NextResponse.json({ result });
  } catch (err) {
    return mapVerificationError(err, "VERIFICATION_IFSC_LOOKUP");
  }
}
