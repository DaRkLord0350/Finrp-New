// ============================================================
// GET /api/oauth/zoho — Initiate Zoho OAuth 2.0 flow
// Builds the authorization URL and redirects the user.
// Query params: integrationId, dataCenter
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { buildAuthorizationUrl } from "@/lib/connectors/zoho/oauth";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get("integrationId");
  const dataCenter = (searchParams.get("dataCenter") ?? "IN").toUpperCase();

  if (!integrationId) {
    return NextResponse.json({ error: "integrationId is required" }, { status: 400 });
  }

  // Verify the integration belongs to this org and is a Zoho type
  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      organizationId: user.organizationId,
      type: { in: ["ZOHO_CRM", "ZOHO_BOOKS", "ZOHO_INVENTORY"] },
      deletedAt: null,
    },
  });

  if (!integration) {
    return NextResponse.json({ error: "Zoho integration not found" }, { status: 404 });
  }

  const config = integration.config as { clientId?: string } | null;
  const clientId = config?.clientId ?? process.env.ZOHO_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "Zoho client ID not configured. Add ZOHO_CLIENT_ID to environment." },
      { status: 500 }
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/zoho/callback`;

  const authUrl = buildAuthorizationUrl({
    organizationId: user.organizationId,
    integrationId,
    dataCenter,
    clientId,
    redirectUri,
  });

  return NextResponse.redirect(authUrl);
}
