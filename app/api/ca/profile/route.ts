// ============================================================
// /api/ca/profile
//   PATCH → update the signed-in CA's own profile fields.
// Busts the cached session so the next render reflects changes.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCAApi } from "@/lib/ca/api-auth";
import { invalidateUserCache } from "@/lib/auth/session";
import type { Prisma, Specialization } from "@prisma/client";

const SPECIALIZATIONS: Specialization[] = ["GST", "INCOME_TAX", "AUDIT", "ROC", "ACCOUNTING", "PAYROLL"];

export async function PATCH(req: NextRequest) {
  const user = await requireCAApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const data: Prisma.UserUpdateInput = {};

  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    data.name = name;
  }
  if (body?.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
  if (body?.designation !== undefined) data.designation = body.designation ? String(body.designation).trim() : null;
  if (body?.specialization !== undefined) {
    if (body.specialization === null || body.specialization === "") {
      data.specialization = null;
    } else if (SPECIALIZATIONS.includes(body.specialization)) {
      data.specialization = body.specialization as Specialization;
    } else {
      return NextResponse.json({ error: "Invalid specialization" }, { status: 400 });
    }
  }

  await prisma.user.update({ where: { id: user.id }, data });
  await invalidateUserCache(user.clerkId);

  return NextResponse.json({ ok: true });
}
