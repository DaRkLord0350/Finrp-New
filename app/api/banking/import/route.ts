import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { enqueueBankImport } from "@/lib/banking/workers/bank-import.worker";
import { importStatementSchema } from "@/lib/banking/validations";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const body = await req.json();
    const parsed = importStatementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues }, { status: 422 });
    }

    const { bankAccountId, fileType, fileUrl, fileName, fileSize, columnMapping } = parsed.data;

    // Verify account ownership if specified
    if (bankAccountId) {
      const account = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, organizationId: orgId },
      });
      if (!account) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
    }

    const importRecord = await prisma.bankStatementImport.create({
      data: {
        organizationId: orgId,
        bankAccountId: bankAccountId ?? null,
        fileName,
        fileUrl,
        fileType: fileType as never,
        fileSize: fileSize ?? null,
        status: "PENDING",
        metadata: columnMapping ? ({ columnMapping } as never) : undefined,
      },
    });

    await enqueueBankImport({
      importId: importRecord.id,
      organizationId: orgId,
      bankAccountId,
      fileUrl,
      fileType,
      columnMapping: columnMapping as Record<string, string> | undefined,
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
