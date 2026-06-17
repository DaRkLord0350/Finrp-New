// ============================================================
// GET  /api/settings/invoice-appearance  — load appearance (or defaults)
// PUT  /api/settings/invoice-appearance  — upsert appearance
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/middleware";
import { getInvoiceAppearance } from "@/lib/invoices/appearance";
import { invoiceAppearanceSchema } from "@/lib/validations";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const appearance = await getInvoiceAppearance(tenantId);
    return NextResponse.json({ appearance });
  } catch (error) {
    console.error("[INVOICE_APPEARANCE_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    // Customizing branding is a settings-level action.
    try {
      await requirePermission("settings.write");
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = invoiceAppearanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    // Strip undefined so a partial update never clobbers stored values.
    const data = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined)
    );

    await prisma.invoiceAppearanceSettings.upsert({
      where: { organizationId: tenantId },
      create: { organizationId: tenantId, ...data },
      update: data,
    });

    const appearance = await getInvoiceAppearance(tenantId);
    return NextResponse.json({ appearance });
  } catch (error) {
    console.error("[INVOICE_APPEARANCE_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
