import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { prisma } from "@/lib/prisma";
import type { LoanAccountStatus, Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") as LoanAccountStatus | null;
    const search = sp.get("search");
    const page = Number(sp.get("page") ?? "1");
    const pageSize = Math.min(Number(sp.get("pageSize") ?? "25"), 100);

    const where: Prisma.LoanAccountWhereInput = {
      organizationId,
      ...(status ? { status } : {}),
      ...(search
        ? { OR: [{ accountNumber: { contains: search, mode: "insensitive" } }, { customer: { name: { contains: search, mode: "insensitive" } } }] }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.loanAccount.findMany({
        where,
        include: { customer: true, product: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.loanAccount.count({ where }),
    ]);
    return NextResponse.json({ items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (err) {
    return mapLendingError(err, "LENDING_ACCOUNTS_GET");
  }
}
