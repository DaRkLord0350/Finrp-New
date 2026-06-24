// ============================================================
// /api/ca/compliance-calendar/[id]
//   PATCH → update an entry (mark complete, reschedule, edit).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCAApi, isAdmin } from "@/lib/ca/api-auth";
import { isCustomerAssignedTo } from "@/lib/ca/portal";
import type { ComplianceCalendarStatus, Prisma } from "@prisma/client";

const STATUSES: ComplianceCalendarStatus[] = ["UPCOMING", "DUE", "OVERDUE", "COMPLETED"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCAApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const entry = await prisma.complianceCalendarEntry.findUnique({
    where: { id },
    select: { id: true, customerId: true },
  });
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  if (!isAdmin(user) && !(await isCustomerAssignedTo(user.id, entry.customerId))) {
    return NextResponse.json({ error: "You are not assigned to this client" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const data: Prisma.ComplianceCalendarEntryUpdateInput = {};

  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    data.status = body.status;
    data.completedAt = body.status === "COMPLETED" ? new Date() : null;
  }
  if (body?.title !== undefined) data.title = String(body.title);
  if (body?.period !== undefined) data.period = body.period ? String(body.period) : null;
  if (body?.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
  if (body?.dueDate !== undefined) {
    const d = new Date(body.dueDate);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    data.dueDate = d;
  }

  const updated = await prisma.complianceCalendarEntry.update({ where: { id }, data, select: { id: true, status: true } });
  return NextResponse.json({ entry: updated });
}
