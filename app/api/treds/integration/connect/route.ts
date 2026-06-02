import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { clientId, clientSecret, apiEndpoint, syncFrequencyMins } = body;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "clientId and clientSecret are required" }, { status: 400 });
    }

    // In production: encrypt clientSecret with AES-256-GCM before storing
    // For now we store it as provided (use env-based key in production)
    const encryptedClientSecret = clientSecret;

    const existing = await prisma.tredsIntegration.findUnique({
      where: { organizationId: tenantId },
    });

    let integration;
    if (existing) {
      integration = await prisma.tredsIntegration.update({
        where: { organizationId: tenantId },
        data: {
          clientId,
          encryptedClientSecret,
          apiEndpoint: apiEndpoint ?? existing.apiEndpoint,
          syncFrequencyMins: syncFrequencyMins ?? existing.syncFrequencyMins,
          status: "PENDING",
          updatedAt: new Date(),
        },
        select: { id: true, provider: true, clientId: true, status: true, apiEndpoint: true },
      });
    } else {
      integration = await prisma.tredsIntegration.create({
        data: {
          organizationId: tenantId,
          clientId,
          encryptedClientSecret,
          apiEndpoint: apiEndpoint ?? "https://api.m1xchange.com/v1",
          syncFrequencyMins: syncFrequencyMins ?? 60,
          status: "PENDING",
          provider: "M1XCHANGE",
        },
        select: { id: true, provider: true, clientId: true, status: true, apiEndpoint: true },
      });
    }

    return NextResponse.json({ integration }, { status: 201 });
  } catch (error) {
    console.error("[TREDS_CONNECT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
