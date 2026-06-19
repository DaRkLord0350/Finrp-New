// GET /api/accounting/audit-trail — accounting audit log with filters
// ?entity=&action=&from=&to=&page=&pageSize=
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";
import { mapAccountingError } from "@/lib/accounting/http";

const ACCOUNTING_ENTITIES = [
  "account", "journal_entry", "fiscal_year", "fiscal_period", "accounting_settings",
  "budget", "exchange_rate", "currency_revaluation", "bulk_account_update",
  "invoice", "payment", "expense", "purchase", "inventory",
];

export async function GET(req: Request) {
  try {
    const { organizationId } = await requirePermission("accounting.read");
    const url = new URL(req.url);
    const entity = url.searchParams.get("entity") || undefined;
    const action = url.searchParams.get("action") || undefined;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25)));

    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      entity: entity ? entity : { in: ACCOUNTING_ENTITIES },
      ...(action ? { action: action as Prisma.EnumAuditActionFilter["equals"] } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + "T23:59:59") } : {}) } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, action: true, entity: true, entityId: true, description: true,
          oldValue: true, newValue: true, createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ rows, total, page, pageSize, entities: ACCOUNTING_ENTITIES });
  } catch (err) {
    return mapAccountingError(err, "AUDIT_TRAIL_GET");
  }
}
