import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { enqueueBankImport } from "@/lib/banking/queue";
import { importStatementSchema } from "@/lib/banking/validations";
import { createAuditLog } from "@/lib/audit";
import type { BankImportFileType } from "@prisma/client";

// Map an uploaded file's extension/mime to the BankImportFileType enum.
const EXT_TYPE: Record<string, BankImportFileType> = {
  csv: "CSV",
  xlsx: "EXCEL",
  xls: "EXCEL",
  pdf: "PDF",
  ofx: "OFX",
  sta: "MT940",
  mt940: "MT940",
};

function detectFileType(name: string, mime: string): BankImportFileType | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (EXT_TYPE[ext]) return EXT_TYPE[ext];
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "EXCEL";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("csv") || mime.includes("text/plain")) return "CSV";
  return null;
}

const EXT_FOR_TYPE: Record<BankImportFileType, string> = {
  CSV: ".csv",
  EXCEL: ".xlsx",
  PDF: ".pdf",
  OFX: ".ofx",
  MT940: ".sta",
};

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json(
        { error: "Expected multipart/form-data with a 'file' field" },
        { status: 400 }
      );
    }

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_BYTES / (1024 * 1024)} MB)` },
        { status: 413 }
      );
    }

    const fileType = detectFileType(file.name, file.type);
    if (!fileType) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload CSV, Excel, PDF, OFX or MT940." },
        { status: 415 }
      );
    }

    const bankAccountIdRaw = form.get("bankAccountId");
    const columnMappingRaw = form.get("columnMapping");

    let columnMapping: Record<string, string> | undefined;
    if (typeof columnMappingRaw === "string" && columnMappingRaw.trim()) {
      try {
        columnMapping = JSON.parse(columnMappingRaw) as Record<string, string>;
      } catch {
        return NextResponse.json({ error: "Invalid columnMapping JSON" }, { status: 400 });
      }
    }

    // Validate the derived metadata (bankAccountId must be a real cuid if given).
    const parsed = importStatementSchema.safeParse({
      bankAccountId:
        typeof bankAccountIdRaw === "string" && bankAccountIdRaw.trim()
          ? bankAccountIdRaw
          : undefined,
      fileType,
      fileName: file.name,
      fileSize: file.size,
      columnMapping,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", issues: parsed.error.issues },
        { status: 422 }
      );
    }
    const { bankAccountId, fileName, fileSize } = parsed.data;

    // Verify account ownership if specified.
    if (bankAccountId) {
      const account = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, organizationId: orgId },
        select: { id: true },
      });
      if (!account) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
    }

    // Persist the uploaded bytes (tmp/, mirroring the main CSV import); the
    // bank-import Inngest function reads this path during processing.
    const uploadDir = join(process.cwd(), "tmp", "banking-imports", orgId);
    await mkdir(uploadDir, { recursive: true });
    const storedPath = join(uploadDir, `${randomUUID()}${EXT_FOR_TYPE[fileType]}`);
    await writeFile(storedPath, Buffer.from(await file.arrayBuffer()));

    const importRecord = await prisma.bankStatementImport.create({
      data: {
        organizationId: orgId,
        bankAccountId: bankAccountId ?? null,
        fileName,
        fileUrl: storedPath,
        fileType,
        fileSize: fileSize ?? null,
        status: "PENDING",
        metadata: columnMapping ? ({ columnMapping } as never) : undefined,
      },
    });

    await enqueueBankImport({
      importId: importRecord.id,
      organizationId: orgId,
      bankAccountId,
      fileUrl: storedPath,
      fileType,
      columnMapping,
    });

    await createAuditLog({
      organizationId: orgId,
      userId,
      action: "CREATE",
      entity: "BankStatementImport",
      entityId: importRecord.id,
      description: `Started import of ${fileName} (${fileType})`,
    });

    return NextResponse.json({ importId: importRecord.id, status: "PENDING" }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "import-statement" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const bankAccountId = searchParams.get("bankAccountId");
  const importId = searchParams.get("id");

  if (importId) {
    const imp = await prisma.bankStatementImport.findFirst({
      where: { id: importId, organizationId: orgId },
    });
    if (!imp) return NextResponse.json({ error: "Import not found" }, { status: 404 });
    return NextResponse.json({ import: imp });
  }

  const imports = await prisma.bankStatementImport.findMany({
    where: {
      organizationId: orgId,
      ...(bankAccountId ? { bankAccountId } : {}),
    },
    include: {
      bankAccount: { select: { bankName: true, accountNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ imports });
}
