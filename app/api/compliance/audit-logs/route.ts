import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requirePermission("compliance.read");
    const url = new URL(req.url);
    const submissionId = url.searchParams.get("submissionId");
    const action = url.searchParams.get("action");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, parseInt(url.searchParams.get("pageSize") ?? "50", 10));

    const where = {
      organizationId,
      ...(submissionId && { submissionId }),
      ...(action && { action }),
    };

    const [logs, total] = await prisma.$transaction([
      prisma.complianceAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.complianceAuditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_AUDIT_LOGS_GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
