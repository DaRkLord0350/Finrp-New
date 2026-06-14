// ============================================================
// Activity Logs & Audit Trail
// ============================================================

import { prisma } from "@/lib/prisma";
import { resolveDateRange } from "./filters";
import type { ReportFilters, ReportResult } from "./types";

interface ActivityLogRow {
  id:          string;
  timestamp:   string;
  userName:    string;
  action:      string;
  entity:      string;
  entityId:    string;
  description: string;
  ipAddress:   string;
}

export async function generateActivityLogs(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<ActivityLogRow>> {
  const { startDate, endDate } = resolveDateRange(filters);

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      createdAt: { gte: startDate, lte: endDate },
      ...(filters.status ? { action: filters.status as "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "EXPORT" | "SETTINGS_CHANGE" } : {}),
    },
    select: {
      id:          true,
      action:      true,
      entity:      true,
      entityId:    true,
      description: true,
      ipAddress:   true,
      createdAt:   true,
      user: {
        select: { name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take:    500,
  });

  const rows: ActivityLogRow[] = logs.map((l) => ({
    id:          l.id,
    timestamp:   l.createdAt.toISOString(),
    userName:    l.user?.name ?? l.user?.email ?? "System",
    action:      l.action,
    entity:      l.entity,
    entityId:    l.entityId ?? "",
    description: l.description,
    ipAddress:   l.ipAddress ?? "",
  }));

  // Action count breakdown
  const actionCounts: Record<string, number> = {};
  for (const r of rows) {
    actionCounts[r.action] = (actionCounts[r.action] ?? 0) + 1;
  }

  return {
    slug:        "activity-logs",
    name:        "Activity Logs & Audit Trail",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalEntries:   rows.length,
      creates:        actionCounts["CREATE"]           ?? 0,
      updates:        actionCounts["UPDATE"]           ?? 0,
      deletes:        actionCounts["DELETE"]           ?? 0,
      logins:         actionCounts["LOGIN"]            ?? 0,
      exports:        actionCounts["EXPORT"]           ?? 0,
      settingsChanges: actionCounts["SETTINGS_CHANGE"] ?? 0,
    },
    columns: [
      { key: "timestamp",   label: "Timestamp",   type: "date",  sortable: true },
      { key: "userName",    label: "User",        type: "text",  sortable: true },
      { key: "action",      label: "Action",      type: "badge", sortable: true },
      { key: "entity",      label: "Entity",      type: "text",  sortable: true },
      { key: "description", label: "Description", type: "text" },
      { key: "ipAddress",   label: "IP Address",  type: "text" },
    ],
    rows,
    charts: [
      {
        type:  "bar",
        title: "Actions by Type",
        data:  Object.entries(actionCounts).map(([action, count]) => ({ action, count })),
        xKey:  "action",
        yKeys: ["count"],
      },
    ],
  };
}
