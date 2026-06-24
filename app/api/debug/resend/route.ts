// ============================================================
// GET /api/debug/resend?to=you@example.com
//
// Sends a single test email straight through Resend (the same
// sendEmail() path used by invitations) so delivery can be verified
// independently of the onboarding flow. Returns the Resend message id
// or the exact error — never silently succeeds.
//
// Access: a signed-in user, OR ?key=<DEBUG_EMAIL_SECRET> when that env
// is configured (lets you probe production without logging in).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sendEmail, emailConfigStatus } from "@/lib/notifications/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // ── Authorize ──────────────────────────────────────────────
  const key = req.nextUrl.searchParams.get("key");
  const debugSecret = process.env.DEBUG_EMAIL_SECRET?.trim();
  const secretOk = Boolean(debugSecret) && key === debugSecret;

  let authed = secretOk;
  if (!authed) {
    const { userId } = await auth();
    authed = Boolean(userId);
  }
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = emailConfigStatus();

  const to = req.nextUrl.searchParams.get("to")?.trim();
  if (!to) {
    // No recipient → just report configuration (a quick health check).
    return NextResponse.json({
      success: false,
      error: "Add ?to=<email> to send a test message",
      config,
    });
  }

  const result = await sendEmail({
    to,
    subject: "FinRP Resend test email",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px">✅ Resend is working</h2>
        <p style="color:#555;font-size:14px">
          This is a test email from FinRP sent directly through Resend at
          ${new Date().toISOString()}.
        </p>
        <p style="color:#9ca3af;font-size:12px">Sender: ${config.from}</p>
      </div>`,
  });

  return NextResponse.json(
    {
      success: result.success,
      messageId: result.id ?? null,
      error: result.error ?? null,
      config,
    },
    { status: result.success ? 200 : 502 }
  );
}
