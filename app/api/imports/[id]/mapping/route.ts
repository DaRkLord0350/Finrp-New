// ============================================================
// POST /api/imports/[id]/mapping
// Saves column mapping rules and enqueues the import job.
//
// Failure guarantees (why this can never get stuck):
//   • fieldMapping is persisted before Redis is touched → mapping
//     survives if enqueue fails, user can retry
//   • If enqueue fails  → status reset to MAPPING + error stored,
//     409 guard released, user sees actionable error and can retry
//   • If QUEUED DB update fails after successful enqueue → BullMQ
//     job exists, worker finds fieldMapping on the record and
//     self-heals (MAPPING→PROCESSING→COMPLETED)
//   • The MAPPING status is never in the block set, so any failure
//     that leaves status=MAPPING always allows a retry from the UI
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { enqueueImport } from "@/lib/jobs/queues";
import { buildDefaultRules } from "@/lib/mapping/engine";
import {
  CUSTOMER_TARGET_FIELDS,
  INVOICE_TARGET_FIELDS,
  PRODUCT_TARGET_FIELDS,
  CA_USER_TARGET_FIELDS,
  FIRM_TARGET_FIELDS,
  ASSIGNMENT_TARGET_FIELDS,
  MASTER_IMPORT_TARGET_FIELDS,
} from "@/lib/mapping/engine";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const ENTITY_TARGET_FIELDS: Record<string, { field: string; label: string; required: boolean }[]> = {
  CUSTOMERS: CUSTOMER_TARGET_FIELDS,
  VENDORS: CUSTOMER_TARGET_FIELDS,
  INVOICES: INVOICE_TARGET_FIELDS,
  PRODUCTS: PRODUCT_TARGET_FIELDS,
  CA_USERS: CA_USER_TARGET_FIELDS,
  FIRMS: FIRM_TARGET_FIELDS,
  ASSIGNMENTS: ASSIGNMENT_TARGET_FIELDS,
  MASTER_IMPORT: MASTER_IMPORT_TARGET_FIELDS,
  EMPLOYEES: [
    { field: "name", label: "Full Name", required: true },
    { field: "email", label: "Work Email", required: false },
    { field: "phone", label: "Phone", required: false },
    { field: "designation", label: "Job Title", required: false },
    { field: "department", label: "Department", required: false },
    { field: "dateOfJoining", label: "Date of Joining", required: false },
    { field: "dateOfBirth", label: "Date of Birth", required: false },
  ],
};

const mappingSchema = z.object({
  fieldMapping: z
    .array(
      z.object({
        sourceField: z.string().min(1),
        targetField: z.string().min(1),
        required: z.boolean(),
        transforms: z.array(z.record(z.string(), z.unknown())).default([]),
        defaultValue: z.string().optional(),
        skipIfEmpty: z.boolean().optional(),
      })
    )
    .min(1, "At least one mapping rule is required")
    .optional(),
  useAutoMapping: z.boolean().optional(),
});

// These statuses mean the job is already committed to a queue or done.
// Block re-submission to prevent duplicates.
const BLOCK_STATUSES = new Set([
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "PARTIAL",
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log(`[MAPPING] ── START importJobId=${id}`);

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  // ── 1. Load import job ────────────────────────────────────────────────────
  const importJob = await (prisma as any).importJob.findFirst({
    where: { id, organizationId: user.organizationId },
    select: {
      id: true,
      status: true,
      entity: true,
      fileName: true,
      fieldMapping: true,
      detectedColumns: true,
    },
  });

  if (!importJob) {
    console.error(`[MAPPING] importJobId=${id} not found`);
    return NextResponse.json({ error: "Import job not found" }, { status: 404 });
  }

  const currentStatus: string = importJob.status;
  console.log(`[MAPPING] importJobId=${id} currentStatus=${currentStatus}`);

  // ── 2. Gate: block already-running jobs ───────────────────────────────────
  if (BLOCK_STATUSES.has(currentStatus)) {
    console.warn(
      `[MAPPING] BLOCKED importJobId=${id} — already in ${currentStatus}`
    );
    return NextResponse.json(
      {
        error: `Cannot update mapping — import is already ${currentStatus}. ` +
          `Wait for it to complete or cancel it first.`,
      },
      { status: 409 }
    );
  }

  // ── 3. Parse + validate body ──────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
     console.log(
      "[MAPPING BODY]",
      JSON.stringify(body, null, 2)
    );
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = mappingSchema.safeParse(body);
  if (!parsed.success) {
    console.error(
      `[MAPPING] Validation error for importJobId=${id}:`,
      parsed.error.flatten()
    );
    return NextResponse.json(
      { error: "Invalid mapping rules", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  // ── 3.1. Handle auto-mapping ──────────────────────────────────────────────
  let rules = parsed.data.fieldMapping;
  
  if (parsed.data.useAutoMapping === true) {
    console.log(`[MAPPING] useAutoMapping=true for importJobId=${id}`);
    
    const detectedColumns: string[] = importJob.detectedColumns ?? [];
    if (detectedColumns.length === 0) {
      console.error(`[MAPPING] No detectedColumns found for importJobId=${id}`);
      return NextResponse.json(
        { error: "Cannot auto-map: no columns detected in file" },
        { status: 422 }
      );
    }

    // Build target field list for this entity
    const targetFields = ENTITY_TARGET_FIELDS[importJob.entity] ?? CUSTOMER_TARGET_FIELDS;
    const targetFieldOptions = targetFields.map((f) => f.field);

    // Simple auto-mapping: match source headers to target fields by name similarity
    const suggestedMappings: Record<string, string> = {};
    for (const sourceColumn of detectedColumns) {
      const lowerSource = sourceColumn.toLowerCase().trim();
      
      // Exact match first
      const exactMatch = targetFieldOptions.find(
        (t) => t.toLowerCase() === lowerSource
      );
      if (exactMatch) {
        suggestedMappings[sourceColumn] = exactMatch;
        continue;
      }
      
      // Partial match (e.g., "Customer Name" → "name")
      const partialMatch = targetFieldOptions.find((t) => {
        const lowerTarget = t.toLowerCase();
        return lowerSource.includes(lowerTarget) || lowerTarget.includes(lowerSource);
      });
      if (partialMatch) {
        suggestedMappings[sourceColumn] = partialMatch;
      }
    }

    // Build rules from suggested mappings
    rules = buildDefaultRules(
      detectedColumns.filter((c) => suggestedMappings[c]),
      targetFieldOptions,
      suggestedMappings
    );

    if (rules.length === 0) {
      console.error(
        `[MAPPING] Auto-mapping produced no rules for importJobId=${id}`
      );
      return NextResponse.json(
        { error: "Auto-mapping could not match any columns to fields" },
        { status: 422 }
      );
    }

    console.log(
      `[MAPPING] Auto-generated ${rules.length} rules for importJobId=${id}`
    );
  } else if (!rules) {
    // No fieldMapping and no useAutoMapping
    return NextResponse.json(
      { error: "Either fieldMapping or useAutoMapping must be provided" },
      { status: 422 }
    );
  }

  console.log(`[MAPPING] ${rules.length} rules validated for importJobId=${id}`);

  // ── 4. Persist mapping to DB (status stays MAPPING until Redis confirms) ──
  // This is step 1 of a 3-step commit. We persist first so the worker
  // can always find the rules even if the enqueue or final update fail.
  try {
    await (prisma as any).importJob.update({
      where: { id },
      data: {
        fieldMapping: rules as unknown as Prisma.InputJsonValue,
        error: null,
      },
    });
    console.log(`[MAPPING] fieldMapping persisted for importJobId=${id}`);
  } catch (dbErr) {
    const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    console.error(`[MAPPING] DB write failed for importJobId=${id}: ${msg}`);
    return NextResponse.json({ error: "Failed to save mapping rules" }, { status: 500 });
  }
  console.log(
    "[MAPPING] BEFORE ENQUEUE",
    importJob.id
  );
  // ── 5. Enqueue to BullMQ ─────────────────────────────────────────────────
  let bullmqJobId: string;
  try {
    bullmqJobId = await enqueueImport({
      importJobId: id,
      organizationId: user.organizationId,
      entity: importJob.entity,
      options: { skipDuplicates: true, updateExisting: true, dryRun: false },
    });
    console.log(
      "[MAPPING] AFTER ENQUEUE",
      bullmqJobId
    );
    console.log(
      `[MAPPING] Enqueued importJobId=${id} → bullmqJobId=${bullmqJobId}`
    );
  } catch (enqueueErr) {
    const msg = enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr);
    console.error(`[MAPPING] Enqueue FAILED for importJobId=${id}: ${msg}`);
    console.log(
      " [MAPPING] BEFORE QUEUED UPDATE"
    );

    // Roll back to MAPPING + store error so user sees actionable feedback
    await (prisma as any).importJob.update({
      where: { id },
      data: {
        status: "MAPPING",
        error: `Queue unavailable: ${msg}`.slice(0, 1000),
      },
    }).catch((e: unknown) => {
      console.error(
        `[MAPPING] Could not reset status to MAPPING for importJobId=${id}:`,
        e
      );
    });
    console.log(
      "[MAPPING] AFTER QUEUED UPDATE"
    );
    

    return NextResponse.json(
      { error: `Failed to queue import. Redis may be unavailable: ${msg}` },
      { status: 502 }
    );
  }

  // ── 6. Commit QUEUED status + bullmqJobId ────────────────────────────────
  // If this update fails, the BullMQ job still exists. The worker will find
  // fieldMapping on the record and process it regardless of status=MAPPING.
  // The stuck-job checker will detect and normalise the status within 5 min.
  try {
    await (prisma as any).importJob.update({
      where: { id },
      data: {
        status: "QUEUED",
        bullmqJobId,
        queuedAt: new Date(),
        retryCount: { increment: 1 },
        error: null,
      },
    });
    console.log(
      `[MAPPING] ── DONE importJobId=${id} → QUEUED bullmqJobId=${bullmqJobId}`
    );
  } catch (updateErr) {
    // BullMQ job exists. Worker will pick it up and self-heal (MAPPING → PROCESSING).
    // Return success so the frontend moves to the polling step — it WILL complete.
    console.error(
      `[MAPPING] QUEUED update failed for importJobId=${id} ` +
      `(bullmqJobId=${bullmqJobId}). Worker will self-heal.`,
      updateErr
    );
    return NextResponse.json(
      {
        success: true,
        bullmqJobId,
        warning: "Status update delayed — import is queued and will process shortly.",
      },
      { status: 202 }
    );
  }

  return NextResponse.json({ success: true, bullmqJobId });
}
