// ============================================================
// POST /api/imports/[id]/retry — Retry failed rows
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { ETLPipeline } from "@/lib/etl/pipeline";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organizationId = await getOrganizationId();

  try {
    const pipeline = new ETLPipeline();
    const result = await pipeline.retryFailed(id, organizationId);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: err instanceof Error && err.message.includes("not found") ? 404 : 500 });
  }
}
