// ============================================================
// /api/ca/relationships — CA ↔ Business links (CA side)
//
//   GET  → list this CA org's relationships (optional ?status=)
//   POST → invite a business ({ email? , businessOrganizationId?, notes? })
//
// Only CA / CA_FIRM_ADMIN / ADMIN may manage relationships. The CA org
// is always the caller's own organizationId.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { inviteBusiness, RelationshipError } from "@/lib/services/ca-relationship.service";
import { getOrgEntitlements } from "@/lib/billing/guards";
import { toEntitlementsDTO } from "@/lib/billing/entitlements";
import type { Prisma, RelationshipStatus } from "@prisma/client";

const CA_ROLES = ["CA", "CA_FIRM_ADMIN", "ADMIN"] as const;

async function requireCa() {
  const user = await getCurrentUser();
  if (!user.userRole || !CA_ROLES.includes(user.userRole as (typeof CA_ROLES)[number])) {
    return null;
  }
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireCa();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const statusParam = req.nextUrl.searchParams.get("status");
    const where: Prisma.CARelationshipWhereInput = {
      caOrganizationId: user.organizationId,
      ...(statusParam ? { status: statusParam as RelationshipStatus } : {}),
    };

    const [relationships, entitlements] = await Promise.all([
      prisma.cARelationship.findMany({
        where,
        include: {
          businessOrganization: {
            select: {
              id: true,
              name: true,
              planType: true,
              subscriptionStatus: true,
              businessProfile: { select: { businessName: true, gstin: true } },
            },
          },
        },
        orderBy: { invitedAt: "desc" },
      }),
      getOrgEntitlements(user.organizationId),
    ]);

    return NextResponse.json({
      relationships,
      entitlements: toEntitlementsDTO(entitlements),
    });
  } catch (err) {
    return mapError(err, "GET /api/ca/relationships");
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireCa();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json().catch(() => null)) as {
      email?: string;
      businessOrganizationId?: string;
      notes?: string;
    } | null;

    const email = body?.email?.trim();
    if (!email && !body?.businessOrganizationId) {
      return NextResponse.json(
        { error: "Provide an email or a businessOrganizationId" },
        { status: 400 }
      );
    }

    const relationship = await inviteBusiness({
      caOrganizationId: user.organizationId,
      invitedById: user.id,
      email,
      businessOrganizationId: body?.businessOrganizationId,
      notes: body?.notes,
    });

    return NextResponse.json({ relationship }, { status: 201 });
  } catch (err) {
    return mapError(err, "POST /api/ca/relationships");
  }
}

function mapError(err: unknown, ctx: string): NextResponse {
  if (err instanceof RelationshipError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if ((err as Error)?.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.error(`[${ctx}]`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
