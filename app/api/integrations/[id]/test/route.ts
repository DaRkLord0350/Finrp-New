// ============================================================
// GET /api/integrations/[id]/test — Test connector connection
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createConnector } from "@/lib/connectors/factory";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  try {
    const connector = await createConnector(id, user.organizationId);
    const result = await connector.testConnection();

    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, latencyMs: 0, error: message },
      { status: 500 }
    );
  }
}
