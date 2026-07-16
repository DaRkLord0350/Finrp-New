import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { listLetters, issueSanctionLetter, issueOfferLetter } from "@/lib/lending/letters";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { id } = await params;
    const letters = await listLetters(id, organizationId);
    return NextResponse.json({ letters });
  } catch (err) {
    return mapLendingError(err, "LENDING_LETTERS_GET");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId, role } = await requireTenant({ permission: "lending.sanction" });
    const { id } = await params;
    const { type } = await req.json();

    const letter =
      type === "SANCTION_LETTER"
        ? await issueSanctionLetter(id, organizationId, { userId, role })
        : type === "OFFER_LETTER"
          ? await issueOfferLetter(id, organizationId, { userId })
          : null;
    if (!letter) return NextResponse.json({ error: "type must be 'SANCTION_LETTER' or 'OFFER_LETTER'" }, { status: 400 });
    return NextResponse.json({ letter }, { status: 201 });
  } catch (err) {
    return mapLendingError(err, "LENDING_LETTERS_POST");
  }
}
