// ============================================================
// GET  /api/imports   — List import jobs for the org
// POST /api/imports   — Upload file + create import job
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { enqueueImport } from "@/lib/jobs/queues";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { parseCSVContent } from "@/lib/connectors/csv/parser";
import { parseExcelBuffer } from "@/lib/connectors/excel/parser";
import type { ImportEntity, ImportType } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET — list import history
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const entity = searchParams.get("entity");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const skip = (page - 1) * limit;

  const where = {
    organizationId: user.organizationId,
    ...(status && { status: status as "PENDING" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "PARTIAL" | "MAPPING" }),
    ...(entity && { entity: entity as ImportEntity }),
  };

  const [imports, total] = await Promise.all([
    (prisma as any).importJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        type: true,
        entity: true,
        status: true,
        fileName: true,
        originalName: true,
        fileSize: true,
        totalRows: true,
        processedRows: true,
        successRows: true,
        failedRows: true,
        skippedRows: true,
        duplicateRows: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        uploadedById: true,
      },
    }),
    (prisma as any).importJob.count({ where }),
  ]);

  return NextResponse.json({
    imports,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// ---------------------------------------------------------------------------
// POST — upload file + create import job
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const entityRaw = formData.get("entity") as string | null;
  const mappingJson = formData.get("fieldMapping") as string | null;
  const integrationId = formData.get("integrationId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!entityRaw) {
    return NextResponse.json({ error: "entity is required" }, { status: 400 });
  }

  const validEntities: ImportEntity[] = [
    "CUSTOMERS", "VENDORS", "INVOICES", "PRODUCTS",
    "EMPLOYEES", "EXPENSES", "PAYMENTS", "LEADS",
    "CA_USERS", "FIRMS", "ASSIGNMENTS", "MASTER_IMPORT",
  ];
  const entity = entityRaw.toUpperCase() as ImportEntity;

  if (!validEntities.includes(entity)) {
    return NextResponse.json({ error: `Invalid entity. Must be one of: ${validEntities.join(", ")}` }, { status: 400 });
  }

  // ── Detect file type ──
  const mimeType = file.type;
  const originalName = file.name;
  const fileSize = file.size;
  const isExcel =
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    originalName.endsWith(".xlsx") ||
    originalName.endsWith(".xls");

  const importType: ImportType = isExcel ? "EXCEL" : "CSV";

  // ── Save file to tmp directory ──
  const uploadDir = join(process.cwd(), "tmp", "imports", user.organizationId);
  await mkdir(uploadDir, { recursive: true });

  const ext = isExcel ? ".xlsx" : ".csv";
  const fileName = `${randomUUID()}${ext}`;
  const filePath = join(uploadDir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  // ── Quick parse for header detection ──
  let detectedColumns: string[] = [];
  try {
    if (isExcel) {
      const parsed = parseExcelBuffer(buffer);
      detectedColumns = parsed.headers;
    } else {
      const content = buffer.toString("utf-8");
      const parsed = parseCSVContent(content);
      detectedColumns = parsed.headers;
    }
  } catch {
    // Non-fatal — columns can be detected later
  }

  // ── Resolve field mapping ──
  let fieldMapping: unknown = null;
  if (mappingJson) {
    try {
      fieldMapping = JSON.parse(mappingJson);
    } catch {
      return NextResponse.json({ error: "Invalid fieldMapping JSON" }, { status: 400 });
    }
  }

  // ── Create ImportJob ──
  const importJob = await (prisma as any).importJob.create({
    data: {
      organizationId: user.organizationId,
      type: importType,
      entity,
      status: fieldMapping ? "PENDING" : "MAPPING",
      fileName,
      originalName,
      fileSize,
      filePath,
      mimeType,
      detectedColumns,
      fieldMapping: fieldMapping ?? undefined,
      uploadedById: userId,
      ...(integrationId && { integrationId }),
    },
  });

  // ── Enqueue if mapping is ready ──
  let bullmqJobId: string | null = null;
  if (fieldMapping) {
    bullmqJobId = await enqueueImport({
      importJobId: importJob.id,
      organizationId: user.organizationId,
      entity,
      options: { skipDuplicates: true, updateExisting: true, dryRun: false },
    });

    // Persist the BullMQ job ID AND advance status to QUEUED.
    // Without status: "QUEUED", the job stays PENDING indefinitely even though
    // it is already in the Redis queue and the worker may start at any moment.
    await (prisma as any).importJob.update({
      where: { id: importJob.id },
      data: { bullmqJobId, status: "QUEUED" },
    });
  }

  return NextResponse.json(
    {
      importJobId: importJob.id,
      status: importJob.status,
      detectedColumns,
      needsMapping: !fieldMapping,
      bullmqJobId,
    },
    { status: 201 }
  );
}
