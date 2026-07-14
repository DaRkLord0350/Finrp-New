import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { relatedPartyService } from "@/lib/services/related-party.service";
import { mapRelatedPartyError } from "@/lib/related-party/http";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("organization.write");
    const { id } = await params;

    const party = await relatedPartyService.verify(organizationId, { userId: user.id }, id);
    return NextResponse.json(party);
  } catch (err) {
    return mapRelatedPartyError(err, "RELATED_PARTY_VERIFY");
  }
}
