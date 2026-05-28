// ============================================================
// GET /api/oauth/zoho/callback — Zoho OAuth callback handler
// Exchanges code for tokens, stores encrypted, marks ACTIVE.
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeState, exchangeCodeForTokens, storeZohoTokens } from "@/lib/connectors/zoho/oauth";
import { encrypt } from "@/lib/crypto/token-encryption";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // ── Handle OAuth errors (user denied, etc.) ──
  if (error) {
    console.error("[ZohoCallback] OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      `${appUrl}/integrations/zoho?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      `${appUrl}/integrations/zoho?error=missing_params`
    );
  }

  // ── Decode and validate state ──
  let state: ReturnType<typeof decodeState>;
  try {
    state = decodeState(stateParam);
  } catch {
    return NextResponse.redirect(
      `${appUrl}/integrations/zoho?error=invalid_state`
    );
  }

  const { organizationId, integrationId, dataCenter } = state;

  // ── Verify integration record still exists ──
  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      organizationId,
      deletedAt: null,
    },
  });

  if (!integration) {
    return NextResponse.redirect(
      `${appUrl}/integrations/zoho?error=integration_not_found`
    );
  }

  try {
    const config = integration.config as {
      clientId?: string;
      clientSecretEncrypted?: string;
    } | null;

    const clientId = config?.clientId ?? process.env.ZOHO_CLIENT_ID ?? "";
    const clientSecret = config?.clientSecretEncrypted
      ? config.clientSecretEncrypted // store encrypted; ZohoAPI decrypts on use
      : process.env.ZOHO_CLIENT_SECRET ?? "";

    if (!clientId || !clientSecret) {
      throw new Error("Zoho client credentials not configured");
    }

    const redirectUri = `${appUrl}/api/oauth/zoho/callback`;

    // The clientSecret from environment is plaintext here; encrypt before passing to token store
    const clientSecretPlain = clientSecret;

    const tokens = await exchangeCodeForTokens({
      code,
      dataCenter,
      clientId,
      clientSecret: clientSecretPlain,
      redirectUri,
    });

    // Store tokens + update integration status
    await storeZohoTokens({
      integrationId,
      organizationId,
      tokens,
      dataCenter,
    });

    // Persist clientSecret encrypted in integration config (for future token refreshes)
    if (!config?.clientSecretEncrypted) {
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          config: {
            ...(config ?? {}),
            clientSecretEncrypted: encrypt(clientSecretPlain),
            dataCenter,
          },
        },
      });
    }

    return NextResponse.redirect(
      `${appUrl}/integrations/zoho?connected=true&id=${integrationId}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_exchange_failed";
    console.error("[ZohoCallback] Token exchange failed:", message);

    return NextResponse.redirect(
      `${appUrl}/integrations/zoho?error=${encodeURIComponent(message)}`
    );
  }
}
