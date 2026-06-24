// ============================================================
// /api/ca/agreements
//   POST → upsert a client's FIRM or CUSTOMER agreement summary.
// One agreement per (customer, kind). Scoped to assigned clients.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCAApi, isAdmin } from "@/lib/ca/api-auth";
import { isCustomerAssignedTo } from "@/lib/ca/portal";
import type { AgreementKind, Prisma } from "@prisma/client";

const KINDS: AgreementKind[] = ["FIRM", "CUSTOMER"];
const STATUSES = ["ACTIVE", "DRAFT", "EXPIRED"];

export async function POST(req: NextRequest) {
  const user = await requireCAApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const customerId = String(body?.customerId ?? "");
  const kind = body?.kind as AgreementKind;

  if (!customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Invalid agreement kind" }, { status: 400 });

  if (!isAdmin(user) && !(await isCustomerAssignedTo(user.id, customerId))) {
    return NextResponse.json({ error: "You are not assigned to this client" }, { status: 403 });
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { organizationId: true } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const status = STATUSES.includes(body?.status) ? body.status : "ACTIVE";
  const renewalDate = body?.renewalDate ? new Date(body.renewalDate) : null;
  const monthlyFee: Prisma.Decimal | number | null =
    body?.monthlyFee === null || body?.monthlyFee === undefined || body?.monthlyFee === ""
      ? null
      : Number(body.monthlyFee);
  const slaHours = body?.slaHours === null || body?.slaHours === undefined || body?.slaHours === "" ? null : Number(body.slaHours);
  const serviceScope = body?.serviceScope ? String(body.serviceScope) : null;
  const notes = body?.notes ? String(body.notes) : null;

  const agreement = await prisma.clientAgreementSummary.upsert({
    where: { customerId_kind: { customerId, kind } },
    create: {
      customerId,
      organizationId: customer.organizationId,
      kind,
      serviceScope,
      renewalDate,
      monthlyFee,
      slaHours,
      notes,
      status,
      createdById: user.id,
    },
    update: { serviceScope, renewalDate, monthlyFee, slaHours, notes, status },
  });

  return NextResponse.json({ id: agreement.id });
}
