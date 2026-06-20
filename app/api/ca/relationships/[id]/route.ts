// ============================================================
// /api/ca/relationships/[id] — single relationship (CA side)
//
//   PATCH  { action: "terminate" }  → unlink the business
//   DELETE                          → unlink the business
//
// The relationship must belong to the caller's CA org (or caller=ADMIN).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { terminateRelationship, RelationshipError } from "@/lib/services/ca-relationship.service";

const CA_ROLES = ["CA", "CA_FIRM_ADMIN", "ADMIN"] as const;

async function authorize(id: string) {
  const user = await getCurrentUser();
  if (!user.userRole || !CA_ROLES.includes(user.userRole as (typeof CA_ROLES)[number])) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const rel = await prisma.cARelationship.findUnique({ where: { id } });
  if (!rel) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (user.userRole !== "ADMIN" && rel.caOrganizationId !== user.organizationId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, rel };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorize(id);
    if (auth.error) return auth.error;

    const body = (await req.json().catch(() => null)) as { action?: string } | null;
    if (body?.action && body.action !== "terminate") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const rel = await terminateRelationship({ relationshipId: id, actorUserId: auth.user.id });
    return NextResponse.json({ relationship: rel });
  } catch (err) {
    return mapError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorize(id);
    if (auth.error) return auth.error;

    const rel = await terminateRelationship({ relationshipId: id, actorUserId: auth.user.id });
    return NextResponse.json({ relationship: rel });
  } catch (err) {
    return mapError(err);
  }
}

function mapError(err: unknown): NextResponse {
  if (err instanceof RelationshipError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error("[/api/ca/relationships/[id]]", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
