// ============================================================
// /api/business/ca-link — CA connection (business side)
//
//   GET  → current CA link + any pending invitations for this business
//   POST { relationshipId } → accept an invitation (grants Connected)
//
// A business may accept an invite addressed to its org id directly, or
// one addressed to the signed-in user's email.
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { acceptRelationship, RelationshipError } from "@/lib/services/ca-relationship.service";
import { getOrgEntitlements } from "@/lib/billing/guards";
import { toEntitlementsDTO } from "@/lib/billing/entitlements";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const orgId = user.organizationId;

    const [org, pending, entitlements] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          linkedCAOrganizationId: true,
          relationshipStatus: true,
          planType: true,
          linkedCAOrganization: { select: { id: true, name: true } },
        },
      }),
      prisma.cARelationship.findMany({
        where: {
          status: "PENDING",
          OR: [
            { businessOrganizationId: orgId },
            ...(user.email ? [{ invitedEmail: { equals: user.email, mode: "insensitive" as const } }] : []),
          ],
        },
        include: { caOrganization: { select: { id: true, name: true } } },
        orderBy: { invitedAt: "desc" },
      }),
      getOrgEntitlements(orgId),
    ]);

    return NextResponse.json({
      link: org?.linkedCAOrganizationId
        ? {
            caOrganizationId: org.linkedCAOrganizationId,
            caName: org.linkedCAOrganization?.name ?? null,
            status: org.relationshipStatus,
          }
        : null,
      pendingInvitations: pending,
      entitlements: toEntitlementsDTO(entitlements),
    });
  } catch (err) {
    return mapError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const orgId = user.organizationId;
    const body = (await req.json().catch(() => null)) as { relationshipId?: string } | null;
    if (!body?.relationshipId) {
      return NextResponse.json({ error: "relationshipId is required" }, { status: 400 });
    }

    const rel = await prisma.cARelationship.findUnique({ where: { id: body.relationshipId } });
    if (!rel || rel.status !== "PENDING") {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // Authorisation: invite must target this org or this user's email.
    const matchesOrg = rel.businessOrganizationId === orgId;
    const matchesEmail =
      !!rel.invitedEmail &&
      !!user.email &&
      rel.invitedEmail.toLowerCase() === user.email.toLowerCase();
    if (!matchesOrg && !matchesEmail) {
      return NextResponse.json({ error: "This invitation is not addressed to you" }, { status: 403 });
    }

    const accepted = await acceptRelationship({
      relationshipId: rel.id,
      businessOrganizationId: orgId,
      acceptedById: user.id,
    });

    const entitlements = await getOrgEntitlements(orgId);
    return NextResponse.json({
      relationship: accepted,
      entitlements: toEntitlementsDTO(entitlements),
    });
  } catch (err) {
    return mapError(err);
  }
}

function mapError(err: unknown): NextResponse {
  if (err instanceof RelationshipError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if ((err as Error)?.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.error("[/api/business/ca-link]", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
