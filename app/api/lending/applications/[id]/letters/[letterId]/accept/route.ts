import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { acceptOfferLetter } from "@/lib/lending/letters";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; letterId: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.write" });
    const { letterId } = await params;
    const letter = await acceptOfferLetter(letterId, organizationId);
    return NextResponse.json({ letter });
  } catch (err) {
    return mapLendingError(err, "LENDING_LETTER_ACCEPT");
  }
}
