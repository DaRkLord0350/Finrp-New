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
import { OAuthConfigValidator, resolveRedirectUri } from "@/lib/connectors/zoho/config-validator";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get("integrationId");
  const dataCenter = (searchParams.get("dataCenter") ?? "IN").toUpperCase();
  let crm = searchParams.get("crm") === "true";
  let books = searchParams.get("books") === "true";
  let inventory = searchParams.get("inventory") === "true";

  if (!integrationId) {
    return NextResponse.json({ error: "integrationId is required" }, { status: 400 });
  }

  // ── Validate Zoho config before any redirect ──
  const configDiag = OAuthConfigValidator.validate();
  if (!configDiag.valid) {
    console.error("[ZohoAuth] Config validation failed:", {
      hasClientId: configDiag.hasClientId,
      clientIdPrefix: configDiag.clientIdPrefix,
      hasClientSecret: configDiag.hasClientSecret,
      clientSecretLength: configDiag.clientSecretLength,
      hasRedirectUri: configDiag.hasRedirectUri,
      redirectUri: configDiag.redirectUri,
      hasEncryptionKey: configDiag.hasEncryptionKey,
      errors: configDiag.errors,
    });
    return NextResponse.json(
      {
        error: "ZOHO_CONFIG_INVALID",
        details: configDiag.errors,
        diagnostics: {
          hasClientId: configDiag.hasClientId,
          hasClientSecret: configDiag.hasClientSecret,
          hasRedirectUri: configDiag.hasRedirectUri,
          hasEncryptionKey: configDiag.hasEncryptionKey,
        },
      },
      { status: 500 }
    );
  }

  // ── Verify the integration belongs to this org and is a Zoho type ──
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

  // ── If no module params in URL, fall back to persisted config.modules ──
  if (!crm && !books && !inventory) {
    const storedConfig = integration.config as {
      clientId?: string;
      modules?: { crm?: boolean; books?: boolean; inventory?: boolean };
    } | null;
    const stored = storedConfig?.modules;
    if (stored) {
      crm = stored.crm === true;
      books = stored.books === true;
      inventory = stored.inventory === true;
      console.log("[ZohoAuth] Module params missing from URL — using persisted config:", { crm, books, inventory });
    }
  }

  // At least one module must be selected (URL or DB)
  if (!crm && !books && !inventory) {
    // Last resort: derive from integration type
    if (integration.type === "ZOHO_CRM") crm = true;
    else if (integration.type === "ZOHO_BOOKS") books = true;
    else if (integration.type === "ZOHO_INVENTORY") inventory = true;
    console.log("[ZohoAuth] Module params not in URL or config — derived from type:", { crm, books, inventory });
  }

  if (!crm && !books && !inventory) {
    return NextResponse.json(
      { error: "At least one module (crm, books, inventory) must be selected" },
      { status: 400 }
    );
  }

  const config = integration.config as { clientId?: string } | null;
  const clientId = (config?.clientId ?? process.env.ZOHO_CLIENT_ID ?? "").trim();

  if (!clientId) {
    return NextResponse.json(
      { error: "Zoho client ID not configured. Add ZOHO_CLIENT_ID to environment." },
      { status: 500 }
    );
  }

  // Use canonical redirect URI — must match Zoho API Console and callback route exactly
  const redirectUri = resolveRedirectUri();

  console.log("[ZohoAuth] Starting authorization flow:", {
    integrationId,
    dataCenter,
    hasClientId: !!clientId,
    clientIdPrefix: clientId.substring(0, 10),
    redirectUri,
    modules: { crm, books, inventory },
  });

  const authUrl = buildAuthorizationUrl({
    organizationId: user.organizationId,
    integrationId,
    dataCenter,
    clientId,
    redirectUri,
    modules: { crm, books, inventory },
  });

  return NextResponse.redirect(authUrl);
}
