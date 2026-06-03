// ============================================================
// /imports — Import History Page
// ============================================================

import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  Plus,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import type { ImportJob, ImportStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: ImportStatus) {
  const map: Record<ImportStatus, { icon: React.FC<{ className?: string }>; className: string; label: string }> = {
    COMPLETED: { icon: CheckCircle2, className: "text-green-600 border-green-200 bg-green-50", label: "Completed" },
    PARTIAL: { icon: AlertCircle, className: "text-amber-600 border-amber-200 bg-amber-50", label: "Partial" },
    FAILED: { icon: XCircle, className: "text-destructive border-destructive/30", label: "Failed" },
    PROCESSING: { icon: RefreshCw, className: "text-blue-600 border-blue-200 bg-blue-50", label: "Processing" },
    QUEUED: { icon: Clock, className: "text-indigo-600 border-indigo-200 bg-indigo-50", label: "Queued" },
    PENDING: { icon: Clock, className: "text-muted-foreground", label: "Pending" },
    MAPPING: { icon: Clock, className: "text-purple-600 border-purple-200 bg-purple-50", label: "Awaiting Mapping" },
    VALIDATING: { icon: RefreshCw, className: "text-blue-600 border-blue-200 bg-blue-50", label: "Validating" },
    CANCELLED: { icon: XCircle, className: "text-muted-foreground", label: "Cancelled" },
  };

  const { icon: Icon, className, label } = map[status] ?? map.PENDING;

  return (
    <Badge variant="outline" className={`gap-1 text-xs ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(startedAt: Date | null, completedAt: Date | null) {
  if (!startedAt || !completedAt) return "—";
  const ms = completedAt.getTime() - startedAt.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

// ---------------------------------------------------------------------------
// Page content
// ---------------------------------------------------------------------------

async function ImportsContent() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await getCurrentUser();

  const [imports, stats] = await Promise.all([
    (prisma as any).importJob.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, type: true, entity: true, status: true,
        originalName: true, fileSize: true,
        totalRows: true, successRows: true, failedRows: true,
        startedAt: true, completedAt: true, createdAt: true,
      },
    }),
    (prisma as any).importJob.groupBy({
      by: ["status"],
      where: { organizationId: user.organizationId },
      _count: { _all: true },
    }),
  ]);

  const statMap = Object.fromEntries(
    stats.map((s: { status: ImportStatus; _count: { _all: number } }) => [s.status, s._count._all])
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import History</h1>
          <p className="text-muted-foreground mt-1">
            Track all file imports and their status.
          </p>
        </div>
        <Link href="/imports/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Import
          </Button>
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: imports.length, icon: FileSpreadsheet, className: "" },
          { label: "Completed", value: statMap["COMPLETED"] ?? 0, icon: CheckCircle2, className: "text-green-600" },
          { label: "Failed", value: statMap["FAILED"] ?? 0, icon: XCircle, className: "text-destructive" },
          { label: "Processing", value: (statMap["PROCESSING"] ?? 0) + (statMap["PENDING"] ?? 0), icon: RefreshCw, className: "text-blue-600" },
        ].map(({ label, value, icon: Icon, className }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 pt-4">
              <Icon className={`h-5 w-5 shrink-0 ${className}`} />
              <div>
                <p className={`text-xl font-bold ${className}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      {imports.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">No imports yet.</p>
            <Link href="/imports/new">
              <Button className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Start First Import
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">All Imports</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((imp: ImportJob) => (
                  <TableRow key={imp.id} className="group">
                    <TableCell className="font-medium max-w-[180px]">
                      <div className="truncate text-sm" title={imp.originalName}>
                        {imp.originalName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatBytes(imp.fileSize)} · {imp.type}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {imp.entity}
                      </Badge>
                    </TableCell>
                    <TableCell>{statusBadge(imp.status)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {imp.totalRows.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-green-600">
                      {imp.successRows.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-destructive">
                      {imp.failedRows > 0 ? imp.failedRows.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDuration(imp.startedAt, imp.completedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(imp.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Link href={`/imports/${imp.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ImportsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse space-y-4 p-8">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="h-64 bg-muted rounded-xl" />
    </div>}>
      <ImportsContent />
    </Suspense>
  );
}
