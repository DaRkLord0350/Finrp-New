// ============================================================
// GET /api/auth/provision
// Called once after sign-in/sign-up to ensure the user + org
// exist in the database. Safe to call multiple times (idempotent).
// The dashboard layout calls this automatically on every load —
// it's a no-op after the first successful provision.
// ============================================================

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({
      ok: true,
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
    });
  } catch (err) {
    console.error("[provision]", err);
    return NextResponse.json({ ok: false, error: "Failed to provision user" }, { status: 500 });
  }
}
