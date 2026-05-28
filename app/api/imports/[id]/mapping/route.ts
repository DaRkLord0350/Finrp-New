// ============================================================
// POST /api/imports/[id]/mapping
// Save field mapping rules and enqueue the import job.
// Called by the ImportWizard after the mapping step.
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { enqueueImport } from "@/lib/jobs/queues";
import { z } from "zod";

const mappingSchema = z.object({
  fieldMapping: z.array(
    z.object({
      sourceField: z.string(),
      targetField: z.string(),
      required: z.boolean(),
      transforms: z.array(z.record(z.string(), z.unknown())),
      defaultValue: z.string().optional(),
      skipIfEmpty: z.boolean().optional(),
    })
  ).min(1, "At least one mapping rule is required"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getCurrentUser();

  const importJob = await (prisma as any).importJob.findFirst({
    where: { id, organizationId: user.organizationId },
  });

  if (!importJob) {
    return NextResponse.json({ error: "Import job not found" }, { status: 404 });
  }

  if (importJob.status === "PROCESSING" || importJob.status === "COMPLETED") {
    return NextResponse.json(
      { error: `Cannot update mapping — job is already ${importJob.status}` },
      { status: 409 }
    );
  }

  const body = await request.json();
  const parsed = mappingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid mapping", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  // Save mapping + set status back to PENDING ready for processing
  await (prisma as any).importJob.update({
    where: { id },
    data: {
      fieldMapping: parsed.data.fieldMapping as unknown,
      status: "PENDING",
    },
  });

  // Enqueue the import job
  const bullmqJobId = await enqueueImport({
    importJobId: id,
    organizationId: user.organizationId,
    entity: importJob.entity,
    options: { skipDuplicates: true, updateExisting: true, dryRun: false },
  });

  await (prisma as any).importJob.update({
    where: { id },
    data: { bullmqJobId },
  });

  return NextResponse.json({ success: true, bullmqJobId });
}
