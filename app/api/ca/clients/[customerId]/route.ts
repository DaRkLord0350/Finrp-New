// ============================================================
// /api/ca/clients/[customerId]
//   PATCH → update CA-private fields for an assigned client
//           (currently: notes on the CustomerAssignment).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCAApi } from "@/lib/ca/api-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const user = await requireCAApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { customerId } = await params;
  const body = await req.json().catch(() => null);

  if (typeof body?.notes !== "string") {
    return NextResponse.json({ error: "notes is required" }, { status: 400 });
  }

  // updateMany scoped to this CA's own active assignment — also serves
  // as the authorization check (0 rows ⇒ not assigned).
  const result = await prisma.customerAssignment.updateMany({
    where: { caId: user.id, customerId, isActive: true },
    data: { notes: body.notes },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "You are not assigned to this client" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
