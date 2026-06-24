// ============================================================
// /api/ca/compliance-calendar
//   POST → create a compliance deadline for an assigned client.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCAApi, isAdmin } from "@/lib/ca/api-auth";
import { isCustomerAssignedTo } from "@/lib/ca/portal";
import type { ComplianceCalendarType } from "@prisma/client";

const TYPES: ComplianceCalendarType[] = ["GST", "TDS", "ROC", "ITR", "PF", "ESI"];

export async function POST(req: NextRequest) {
  const user = await requireCAApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const customerId = String(body?.customerId ?? "");
  const type = body?.type as ComplianceCalendarType;
  const title = String(body?.title ?? "").trim();
  const dueRaw = body?.dueDate;

  if (!customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  if (!TYPES.includes(type)) return NextResponse.json({ error: "Invalid compliance type" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  const dueDate = dueRaw ? new Date(dueRaw) : null;
  if (!dueDate || isNaN(dueDate.getTime())) return NextResponse.json({ error: "Valid due date is required" }, { status: 400 });

  if (!isAdmin(user) && !(await isCustomerAssignedTo(user.id, customerId))) {
    return NextResponse.json({ error: "You are not assigned to this client" }, { status: 403 });
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { organizationId: true } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const status = dueDate < new Date() ? "OVERDUE" : "UPCOMING";

  const entry = await prisma.complianceCalendarEntry.create({
    data: {
      customerId,
      organizationId: customer.organizationId,
      type,
      title,
      period: body?.period ? String(body.period) : null,
      dueDate,
      status,
      assignedCaId: user.id,
      createdById: user.id,
      notes: body?.notes ? String(body.notes) : null,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: entry.id }, { status: 201 });
}
