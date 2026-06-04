// ============================================================
// GET /api/oauth/zoho/callback — Zoho OAuth callback handler
// Exchanges code for tokens, stores encrypted, marks ACTIVE.
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeState, exchangeCodeForTokens, storeZohoTokens } from "@/lib/connectors/zoho/oauth";
import { encrypt, decrypt } from "@/lib/crypto/token-encryption";
import { enqueueSync } from "@/lib/jobs/queues";
import {
  OAuthConfigValidator,
  dataCenterFromAccountsServer,
  resolveRedirectUri,
} from "@/lib/connectors/zoho/config-validator";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  // Zoho sends the accounts-server it used — tells us the exact DC
  const accountsServer = searchParams.get("accounts-server");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // ── Handle OAuth errors (user denied, etc.) ──
  if (error) {
    console.error("[ZohoCallback] OAuth error from Zoho:", { error, errorDescription });
    return NextResponse.redirect(
      `${appUrl}/integrations/zoho?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !stateParam) {
    console.error("[ZohoCallback] Missing code or state in callback");
    return NextResponse.redirect(`${appUrl}/integrations/zoho?error=missing_params`);
  }

  // ── Decode and validate state ──
  let state: ReturnType<typeof decodeState>;
  try {
    state = decodeState(stateParam);
  } catch {
    console.error("[ZohoCallback] Failed to decode state parameter");
    return NextResponse.redirect(`${appUrl}/integrations/zoho?error=invalid_state`);
  }

  const { organizationId, integrationId, dataCenter: stateDataCenter } = state;

  // ── Reconcile data center: prefer accounts-server over state ──
  //    Zoho's accounts-server param is the ground truth for which DC handled auth.
  const callbackDC = dataCenterFromAccountsServer(accountsServer);
  if (callbackDC && callbackDC !== stateDataCenter) {
    console.warn("[ZohoCallback] DC mismatch — state says", stateDataCenter, "but accounts-server says", callbackDC);
  }
  const effectiveDC = callbackDC ?? stateDataCenter;

  // ── Verify integration record still exists ──
  const integration = await prisma.integration.findFirst({
    where: { id: integrationId, organizationId, deletedAt: null },
  });

  if (!integration) {
    console.error("[ZohoCallback] Integration not found:", { integrationId, organizationId });
    return NextResponse.redirect(`${appUrl}/integrations/zoho?error=integration_not_found`);
  }

  // ── Resolve redirect URI — must be identical to what was sent in auth request ──
  const redirectUri = resolveRedirectUri();

  try {
    const config = integration.config as {
      clientId?: string;
      clientSecretEncrypted?: string;
    } | null;

    const clientId = (config?.clientId ?? process.env.ZOHO_CLIENT_ID ?? "").trim();

    // CRITICAL FIX: decrypt stored secret before use.
    // Before this fix, the AES-256-GCM ciphertext was sent directly to Zoho → invalid_client_secret.
    const clientSecret = config?.clientSecretEncrypted
      ? decrypt(config.clientSecretEncrypted)
      : (process.env.ZOHO_CLIENT_SECRET ?? "").trim();

    // ── Structured diagnostics (no secret values exposed) ──
    console.log("[ZohoCallback] Starting token exchange:", {
      integrationId,
      organizationId,
      effectiveDC,
      accountsServer,
      hasClientId: !!clientId,
      clientIdPrefix: clientId.substring(0, 10),
      hasClientSecret: !!clientSecret,
      clientSecretLength: clientSecret.length,
      redirectUri,
      usingStoredSecret: !!config?.clientSecretEncrypted,
      // Env var diagnostics (no values)
      envDiag: {
        hasEnvClientId: !!process.env.ZOHO_CLIENT_ID,
        hasEnvClientSecret: !!process.env.ZOHO_CLIENT_SECRET,
        hasEnvRedirectUri: !!process.env.ZOHO_REDIRECT_URI,
        envClientSecretLength: process.env.ZOHO_CLIENT_SECRET?.length,
      },
    });

    if (!clientId) {
      throw new Error(
        "ZOHO_CLIENT_ID is not configured. Add ZOHO_CLIENT_ID to environment variables."
      );
    }
    if (!clientSecret) {
      throw new Error(
        "ZOHO_CLIENT_SECRET is not configured. " +
          "Ensure the env var name is exactly ZOHO_CLIENT_SECRET (uppercase). " +
          "Common mistake: using lowercase 'zoho_client_secret' — this fails on Linux/Vercel."
      );
    }

    // Warn if redirect URIs would differ (helps catch Vercel vs localhost mismatches)
    const configDiag = OAuthConfigValidator.validate();
    if (configDiag.hasRedirectUri && configDiag.redirectUri !== redirectUri) {
      console.warn("[ZohoCallback] Redirect URI inconsistency detected:", {
        fromEnvVar: configDiag.redirectUri,
        computedFromAppUrl: `${appUrl}/api/oauth/zoho/callback`,
        usingForExchange: redirectUri,
      });
    }

    const tokens = await exchangeCodeForTokens({
      code,
      dataCenter: effectiveDC,
      clientId,
      clientSecret,
      redirectUri,
    });

    await storeZohoTokens({ integrationId, organizationId, tokens, dataCenter: effectiveDC });

    // Persist encrypted secret in integration config so future refreshes don't need the env var.
    // Only write once — use the env var plaintext (already validated above).
    // Also save the modules that were selected during OAuth.
    if (!config?.clientSecretEncrypted) {
      const rawSecret = (process.env.ZOHO_CLIENT_SECRET ?? "").trim();
      if (rawSecret) {
        await prisma.integration.update({
          where: { id: integrationId },
          data: {
            config: {
              ...(config ?? {}),
              clientSecretEncrypted: encrypt(rawSecret),
              dataCenter: effectiveDC,
              modules: state.modules,
            },
          },
        });
      }
    } else {
      // If secret already stored, just update modules
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          config: {
            ...(config ?? {}),
            modules: state.modules,
          },
        },
      });
    }

    console.log("[ZohoCallback] OAuth complete:", { integrationId, effectiveDC });

    // Queue initial full sync of all entities (customers, invoices, products)
    try {
      const syncJob = await prisma.syncJob.create({
        data: {
          organizationId,
          integrationId,
          type: "FULL",
          entity: "all",
          status: "QUEUED",
          scheduledAt: new Date(),
        },
      });

      const jobId = await enqueueSync({
        syncJobId: syncJob.id,
        organizationId,
        integrationId,
        connectorType: "zoho",
        entity: "all",
        isIncremental: false,
      });

      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: { bullmqJobId: jobId },
      });

      console.log("[ZohoCallback] Initial sync queued:", { syncJobId: syncJob.id, bullmqJobId: jobId });
    } catch (syncErr) {
      console.error("[ZohoCallback] Failed to queue initial sync:", syncErr);
      // Don't fail the OAuth flow — customer can manually sync later
    }

    return NextResponse.redirect(
      `${appUrl}/integrations/zoho?connected=true&id=${integrationId}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_exchange_failed";

    // Parse structured error from exchangeCodeForTokens if available
    let structured: Record<string, unknown> = { error: message };
    try {
      structured = JSON.parse(message);
    } catch {
      // plain text error — wrap it
      structured = {
        error: "ZOHO_TOKEN_EXCHANGE_FAILED",
        message,
        integrationId,
        effectiveDC,
        redirectUri,
        hasEnvClientId: !!process.env.ZOHO_CLIENT_ID,
        hasEnvClientSecret: !!process.env.ZOHO_CLIENT_SECRET,
        envClientSecretLength: process.env.ZOHO_CLIENT_SECRET?.length,
      };
    }

    console.error("[ZohoCallback] Token exchange failed:", structured);

    return NextResponse.redirect(
      `${appUrl}/integrations/zoho?error=${encodeURIComponent(
        typeof structured.zohoError === "string" ? structured.zohoError : message
      )}`
    );
  }
}
