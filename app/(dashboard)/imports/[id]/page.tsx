// ============================================================
// /imports/[id] — Import Detail + Error Resolution
// ============================================================

import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { getOrganizationId } from "@/lib/auth/organization";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { ArrowLeft, Download, RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

async function ImportDetailContent({ id }: { id: string }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const organizationId = await getOrganizationId();

  const [importJob, failedRows] = await Promise.all([
    (prisma as any).importJob.findFirst({
      where: { id, organizationId },
    }),
    (prisma as any).importRow.findMany({
      where: { importJobId: id, status: "FAILED" },
      orderBy: { rowIndex: "asc" },
      take: 50,
      select: {
        id: true,
        rowIndex: true,
        rawData: true,
        error: true,
        warnings: true,
      },
    }),
  ]);

  if (!importJob) notFound();

  const successRate =
    importJob.totalRows > 0
      ? Math.round((importJob.successRows / importJob.totalRows) * 100)
      : 0;

  const rawDataKeys = failedRows[0]
    ? Object.keys(failedRows[0].rawData as Record<string, string>).slice(0, 5)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/imports">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold truncate">{importJob.originalName}</h1>
          <p className="text-sm text-muted-foreground">
            {importJob.entity} · {importJob.type} · {new Date(importJob.createdAt).toLocaleString()}
          </p>
        </div>
        {importJob.failedRows > 0 && (
          <a href={`/api/imports/${id}/download-errors`}>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Download Errors
            </Button>
          </a>
        )}
      </div>

      {/* Progress card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Import Progress</CardTitle>
            <ImportStatusBadge status={importJob.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={successRate} className="h-2" />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: "Total Rows", value: importJob.totalRows, className: "" },
              { label: "Imported", value: importJob.successRows, className: "text-green-600" },
              { label: "Failed", value: importJob.failedRows, className: "text-destructive" },
              { label: "Duplicates", value: importJob.duplicateRows, className: "text-amber-600" },
            ].map(({ label, value, className }) => (
              <div key={label}>
                <p className={`text-2xl font-bold ${className}`}>{value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Failed rows table */}
      {failedRows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Failed Rows ({importJob.failedRows.toLocaleString()})
            </CardTitle>
            <form action={`/api/imports/${id}/retry`} method="POST">
              <Button type="submit" size="sm" variant="outline" className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                Retry All
              </Button>
            </form>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row #</TableHead>
                    {rawDataKeys.map((k) => (
                      <TableHead key={k} className="max-w-[120px]">{k}</TableHead>
                    ))}
                    <TableHead>Error</TableHead>
                    <TableHead>Warnings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedRows.map((row: { id: string; rowIndex: number; rawData: unknown; error: string | null; warnings: string[] }) => {
                    const raw = row.rawData as Record<string, string>;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs">{row.rowIndex + 1}</TableCell>
                        {rawDataKeys.map((k) => (
                          <TableCell key={k} className="max-w-[120px] truncate text-xs">
                            {raw[k] ?? "—"}
                          </TableCell>
                        ))}
                        <TableCell className="text-xs text-destructive max-w-[200px]">
                          {row.error ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-amber-600 max-w-[200px]">
                          {row.warnings.length > 0 ? row.warnings.join("; ") : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {importJob.failedRows > 50 && (
              <p className="text-xs text-muted-foreground px-4 py-3">
                Showing 50 of {importJob.failedRows.toLocaleString()} failed rows.
                Download the error report for the full list.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Success state */}
      {importJob.failedRows === 0 && importJob.status === "COMPLETED" && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="font-medium">All {importJob.successRows.toLocaleString()} rows imported successfully</p>
            <p className="text-sm text-muted-foreground mt-1">No errors found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ImportStatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.FC<{ className?: string }>; label: string; className: string }> = {
    COMPLETED: { icon: CheckCircle2, label: "Completed", className: "text-green-600 border-green-200 bg-green-50" },
    PARTIAL: { icon: AlertCircle, label: "Partial", className: "text-amber-600 border-amber-200 bg-amber-50" },
    FAILED: { icon: XCircle, label: "Failed", className: "text-destructive border-destructive/30" },
    PROCESSING: { icon: RefreshCw, label: "Processing", className: "text-blue-600 border-blue-200 bg-blue-50" },
    PENDING: { icon: RefreshCw, label: "Pending", className: "text-muted-foreground" },
  };

  const { icon: Icon, label, className } = map[status] ?? map.PENDING;

  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export default async function ImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="animate-pulse space-y-4 p-8">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="h-48 bg-muted rounded-xl" />
    </div>}>
      <ImportDetailContent id={id} />
    </Suspense>
  );
}
