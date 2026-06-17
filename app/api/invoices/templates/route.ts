// ============================================================
// GET  /api/invoices/templates  — list saved invoice templates
// POST /api/invoices/templates  — save a named template (appearance snapshot)
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/middleware";
import { invoiceAppearanceSchema } from "@/lib/validations";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(60),
  key: z.string().min(1).max(60),
  config: invoiceAppearanceSchema,
});

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const templates = await prisma.invoiceTemplate.findMany({
      where: { organizationId: tenantId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("[INVOICE_TEMPLATES_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    try {
      await requirePermission("settings.write");
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const template = await prisma.invoiceTemplate.create({
      data: {
        organizationId: tenantId,
        name: parsed.data.name,
        key: parsed.data.key,
        isBuiltIn: false,
        isDefault: false,
        config: parsed.data.config,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("[INVOICE_TEMPLATES_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
