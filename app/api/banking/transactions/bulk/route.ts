import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { bulkSetCategory } from "@/lib/banking/categorization-engine";
import { bulkCategorizeSchema } from "@/lib/banking/validations";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const body = await req.json();
    const parsed = bulkCategorizeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues }, { status: 422 });
    }

    const { transactionIds, category, subCategory, txnType } = parsed.data;

    const count = await bulkSetCategory(orgId, transactionIds, category, subCategory, txnType);

    await createAuditLog({
      organizationId: orgId,
      userId,
      action: "UPDATE",
      entity: "BankTransaction",
      description: `Bulk categorized ${count} transactions to "${category}"`,
    });

    return NextResponse.json({ updated: count });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "bulk-categorize" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
