import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { relatedPartyService } from "@/lib/services/related-party.service";
import { mapRelatedPartyError } from "@/lib/related-party/http";
import { UpdateRelatedPartySchema } from "@/lib/validators/related-party";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("organization.write");
    const { id } = await params;

    const body = await req.json().catch(() => null);
    const parsed = UpdateRelatedPartySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }

    const party = await relatedPartyService.update(organizationId, { userId: user.id }, id, parsed.data);
    return NextResponse.json(party);
  } catch (err) {
    return mapRelatedPartyError(err, "RELATED_PARTY_PATCH");
  }
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  try {
    const { user, organizationId } = await requirePermission("organization.write");
    const { id } = await params;

    await relatedPartyService.remove(organizationId, { userId: user.id }, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return mapRelatedPartyError(err, "RELATED_PARTY_DELETE");
  }
}
