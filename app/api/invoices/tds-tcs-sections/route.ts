// ============================================================
// GET  /api/invoices/tds-tcs-sections — list org sections (lazy-seeds defaults)
// POST /api/invoices/tds-tcs-sections — create a custom section
// ============================================================

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/middleware";
import { ensureTdsTcsSections } from "@/lib/invoices/tds-sections";

export async function GET() {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sections = await ensureTdsTcsSections(organizationId);
    return NextResponse.json({ sections });
  } catch (error) {
    console.error("[TDS_TCS_SECTIONS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let organizationId: string;
    try {
      ({ organizationId } = await requirePermission("invoices.write"));
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const body = await req.json().catch(() => ({}));
    const type = body.type === "TDS" || body.type === "TCS" ? body.type : null;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const rate = Number(body.rate);

    if (!type) return NextResponse.json({ error: "type must be TDS or TCS" }, { status: 400 });
    if (!code) return NextResponse.json({ error: "Section code is required" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Section name is required" }, { status: 400 });
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return NextResponse.json({ error: "Rate must be between 0 and 100" }, { status: 400 });
    }

    try {
      const section = await prisma.tdsTcsSection.create({
        data: { organizationId, type, code, name, rate: new Prisma.Decimal(rate) },
      });
      return NextResponse.json({ section }, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json({ error: `A ${type} section "${code}" already exists.` }, { status: 409 });
      }
      throw e;
    }
  } catch (error) {
    console.error("[TDS_TCS_SECTIONS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
