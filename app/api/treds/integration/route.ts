import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const integration = await prisma.tredsIntegration.findUnique({
      where: { organizationId: tenantId },
      select: {
        id: true,
        provider: true,
        clientId: true,
        apiEndpoint: true,
        status: true,
        lastSyncAt: true,
        syncFrequencyMins: true,
        webhookUrl: true,
        createdAt: true,
        updatedAt: true,
        // Never expose encryptedClientSecret
      },
    });

    return NextResponse.json({ integration });
  } catch (error) {
    console.error("[TREDS_INTEGRATION_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await prisma.tredsIntegration.deleteMany({
      where: { organizationId: tenantId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TREDS_INTEGRATION_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
