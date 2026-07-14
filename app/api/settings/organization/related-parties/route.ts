import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { relatedPartyService } from "@/lib/services/related-party.service";
import { mapRelatedPartyError } from "@/lib/related-party/http";
import { CreateRelatedPartySchema } from "@/lib/validators/related-party";

export const GET = withTenant(
  async (_req, { organizationId }) => {
    try {
      const parties = await relatedPartyService.list(organizationId);
      return NextResponse.json({ parties });
    } catch (err) {
      return mapRelatedPartyError(err, "RELATED_PARTIES_GET");
    }
  },
  { permission: "organization.read" }
);

export const POST = withTenant(
  async (req, { organizationId, userId }) => {
    try {
      const body = await req.json().catch(() => null);
      const parsed = CreateRelatedPartySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
      }
      const party = await relatedPartyService.create(organizationId, { userId }, parsed.data);
      return NextResponse.json(party, { status: 201 });
    } catch (err) {
      return mapRelatedPartyError(err, "RELATED_PARTIES_POST");
    }
  },
  { permission: "organization.write" }
);
