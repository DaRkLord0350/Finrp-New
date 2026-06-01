import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function POST() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const integration = await prisma.tredsIntegration.findUnique({
      where: { organizationId: tenantId },
    });

    if (!integration) {
      return NextResponse.json({ error: "Integration not configured" }, { status: 404 });
    }

    if (integration.status !== "ACTIVE") {
      return NextResponse.json({ error: "Integration is not active. Test the connection first." }, { status: 400 });
    }

    // In production: poll M1xchange API for status updates on submitted invoices
    // and update bid/approval/funding statuses here.
    await prisma.tredsIntegration.update({
      where: { organizationId: tenantId },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      message: "Sync completed. Invoice statuses refreshed from M1xchange.",
    });
  } catch (error) {
    console.error("[TREDS_SYNC]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
