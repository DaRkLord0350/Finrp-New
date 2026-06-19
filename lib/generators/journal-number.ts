// ============================================================
// lib/generators/journal-number.ts
// Collision-safe, organization-scoped journal number generation.
// Uses PostgreSQL ON CONFLICT DO UPDATE for atomic increment, so two
// concurrent posts never receive the same number.
// Format: {prefix}-{YYYY}-{000001}  (default prefix "JN")
// ============================================================

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Atomically generate the next journal number for an organization.
 * Pass the transaction client when generating inside a posting transaction
 * so the number reservation commits/rolls back with the journal entry.
 *
 * @example await generateNextJournalNumber("org_123") → "JN-2026-000001"
 */
export async function generateNextJournalNumber(
  organizationId: string,
  opts: { prefix?: string; client?: Client } = {}
): Promise<string> {
  const prefix = opts.prefix ?? "JN";
  const client = opts.client ?? prisma;
  const year = new Date().getFullYear();
  const id = crypto.randomUUID();

  const result = await client.$queryRaw<Array<{ lastNumber: number }>>`
    INSERT INTO "journal_number_counters" ("id", "organizationId", "prefix", "year", "lastNumber", "updatedAt")
    VALUES (${id}, ${organizationId}, ${prefix}, ${year}, 1, NOW())
    ON CONFLICT ("organizationId", "prefix", "year")
    DO UPDATE SET "lastNumber" = "journal_number_counters"."lastNumber" + 1, "updatedAt" = NOW()
    RETURNING "lastNumber"
  `;

  const nextNumber = Number(result[0]?.lastNumber ?? 1);
  return `${prefix}-${year}-${String(nextNumber).padStart(6, "0")}`;
}
