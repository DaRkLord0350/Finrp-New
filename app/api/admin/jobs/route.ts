// GET /api/admin/jobs — queue health and job observability
// POST /api/admin/jobs — retry DLQ job or clear stuck job

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getJobManagerData, retryDlqJob, clearStuckJob } from "@/lib/services/job-manager.service";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
  if (!user || !["OWNER", "ADMIN"].includes(user.role)) throw new Error("Forbidden");
}

export async function GET() {
  try {
    await requireAdmin();
    const data = await getJobManagerData();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { action, jobId } = await req.json();

    if (action === "retry_dlq") {
      await retryDlqJob(jobId);
      return NextResponse.json({ success: true });
    }
    if (action === "clear_stuck") {
      await clearStuckJob(jobId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
