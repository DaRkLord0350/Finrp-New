// ============================================================
// PATCH  /api/invoices/tds-tcs-sections/[id] — update name/rate/isActive
// DELETE /api/invoices/tds-tcs-sections/[id] — remove a section
// ============================================================

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/middleware";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let organizationId: string;
    try {
      ({ organizationId } = await requirePermission("invoices.write"));
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const data: Prisma.TdsTcsSectionUpdateManyMutationInput = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (body.rate !== undefined) {
      const rate = Number(body.rate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        return NextResponse.json({ error: "Rate must be between 0 and 100" }, { status: 400 });
      }
      data.rate = new Prisma.Decimal(rate);
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.tdsTcsSection.updateMany({ where: { id, organizationId }, data });
    if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TDS_TCS_SECTION_PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let organizationId: string;
    try {
      ({ organizationId } = await requirePermission("invoices.write"));
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const { id } = await params;
    const deleted = await prisma.tdsTcsSection.deleteMany({ where: { id, organizationId } });
    if (deleted.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TDS_TCS_SECTION_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
