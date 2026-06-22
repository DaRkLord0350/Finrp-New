// ============================================================
// /api/tax/config/publish
// POST — publish a config version (archives the prior published one)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/lib/auth/require-tenant";
import { prisma } from "@/lib/prisma";
import { publishTaxConfigVersion } from "@/lib/tax/config/loader";
import { taxAudit } from "@/lib/tax/core/audit";
import { mapTaxError } from "@/lib/tax/http";

const PublishSchema = z.object({ versionId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { organizationId, userId } = await requireTenant({ permission: "tax.manage" });
    const body = await req.json().catch(() => null);
    const parsed = PublishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }

    // Guard tenancy: org-scoped versions must belong to this org.
    const version = await prisma.taxConfigVersion.findUnique({ where: { id: parsed.data.versionId } });
    if (!version || (version.organizationId !== null && version.organizationId !== organizationId)) {
      return NextResponse.json({ error: "Config version not found" }, { status: 404 });
    }

    const published = await publishTaxConfigVersion(parsed.data.versionId, userId);
    await taxAudit({
      organizationId,
      userId,
      action: "SETTINGS_CHANGE",
      entity: "tax.config",
      entityId: published.id,
      description: `Published ${published.scheme} config v${published.version} for ${published.period}`,
    });
    return NextResponse.json({ version: published });
  } catch (err) {
    return mapTaxError(err, "CONFIG_PUBLISH");
  }
}
