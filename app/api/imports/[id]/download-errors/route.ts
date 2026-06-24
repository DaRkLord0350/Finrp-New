// ============================================================
// GET /api/imports/[id]/download-errors
// Download failed rows as an Excel file for correction.
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { prisma } from "@/lib/prisma";
import { generateErrorCSV } from "@/lib/connectors/excel/parser";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organizationId = await getOrganizationId();

  const importJob = await (prisma as any).importJob.findFirst({
    where: { id, organizationId },
    select: { id: true, originalName: true, detectedColumns: true },
  });

  if (!importJob) {
    return NextResponse.json({ error: "Import job not found" }, { status: 404 });
  }

  const failedRows = await (prisma as any).importRow.findMany({
    where: {
      importJobId: id,
      status: "FAILED",
    },
    orderBy: { rowIndex: "asc" },
    select: {
      rowIndex: true,
      rawData: true,
      error: true,
      warnings: true,
    },
  });

  if (failedRows.length === 0) {
    return NextResponse.json({ error: "No failed rows found" }, { status: 404 });
  }

  const errorRows = failedRows.map((row: { rowIndex: number; rawData: unknown; error: string | null; warnings: string[] }) => ({
    rowIndex: row.rowIndex,
    rawData: row.rawData as Record<string, string>,
    errors: row.error ? [row.error] : [],
    warnings: row.warnings,
  }));

  const buffer = generateErrorCSV(importJob.detectedColumns, errorRows);
  const baseName = importJob.originalName.replace(/\.[^.]+$/, "");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${baseName}_errors.xlsx"`,
    },
  });
}
