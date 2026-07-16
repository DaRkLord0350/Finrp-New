// ============================================================
// lib/aml/service.ts
//
// Orchestrates a full AML screen: PEP (reuses the EXISTING
// lib/tbx/service.ts screenAmlPep — not duplicated) + Sanctions
// (fuzzy match against the ingested OFAC/UN watchlist) + Negative
// Media (provider, mock until a vendor is bound). Persists one
// immutable AMLScreening row per check.
//
// A NO_MATCH result on every check auto-completes the AML pipeline
// stage. Any POTENTIAL_MATCH/CONFIRMED_MATCH opens an AMLCase instead
// and deliberately does NOT auto-advance the workflow — a hit must be
// manually cleared (see case-service.ts resolveCase) before the loan
// can proceed. Auto-clearing a sanctions/PEP hit would defeat the
// point of screening.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { AMLAlertType, AMLScreeningType, AMLSubjectType, Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { screenAmlPep } from "@/lib/tbx/service";
import { matchAgainstCandidates } from "./core/name-matching";
import { getNegativeMediaProvider } from "./negative-media";
import * as workflow from "@/lib/lending/workflow/service";
import { raiseAmlCaseAlert } from "@/lib/monitoring/service";

export interface RunScreeningInput {
  subjectType: AMLSubjectType;
  subjectId: string;
  subjectName: string;
  applicationId?: string;
  pan?: string;
  dob?: string;
}

interface ScreeningOutcome {
  type: AMLScreeningType;
  source: string;
  matchStatus: "NO_MATCH" | "POTENTIAL_MATCH" | "CONFIRMED_MATCH";
  matchScore: number | null;
  matchedEntries: unknown;
}

async function generateCaseNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.aMLCase.count({ where: { organizationId } });
  return `AML${year}${String(count + 1).padStart(6, "0")}`;
}

export async function runScreening(organizationId: string, input: RunScreeningInput, actor: { userId: string; role?: string }) {
  const outcomes: ScreeningOutcome[] = [];

  // 1) PEP — reuse the existing TBX provider call, don't duplicate it.
  try {
    const pep = await screenAmlPep(
      { name: input.subjectName, pan: input.pan, dob: input.dob },
      { organizationId, userId: actor.userId, subjectType: input.subjectType.toLowerCase(), subjectId: input.subjectId }
    );
    outcomes.push({
      type: "PEP",
      source: "TBX_PEP",
      matchStatus: pep.isMatch ? (pep.riskLevel === "HIGH" ? "CONFIRMED_MATCH" : "POTENTIAL_MATCH") : "NO_MATCH",
      matchScore: pep.matches?.[0]?.score ?? null,
      matchedEntries: pep.matches ?? null,
    });
  } catch (err) {
    console.warn("[aml] TBX PEP screen failed, continuing with sanctions/media checks:", (err as Error).message);
  }

  // 2) Sanctions — fuzzy match against the ingested global watchlist.
  const watchlistEntries = await prisma.aMLWatchlistEntry.findMany({
    where: { isActive: true },
    select: { id: true, source: true, primaryName: true, aliases: true },
  });
  const bySource = new Map<string, typeof watchlistEntries>();
  for (const entry of watchlistEntries) {
    if (!bySource.has(entry.source)) bySource.set(entry.source, []);
    bySource.get(entry.source)!.push(entry);
  }
  for (const [source, entries] of bySource) {
    const matches = matchAgainstCandidates(
      input.subjectName,
      entries.map((e) => ({ entryId: e.id, primaryName: e.primaryName, aliases: e.aliases }))
    );
    outcomes.push({
      type: "SANCTIONS",
      source,
      matchStatus: matches.length === 0 ? "NO_MATCH" : matches[0].bestScore >= 95 ? "CONFIRMED_MATCH" : "POTENTIAL_MATCH",
      matchScore: matches[0]?.bestScore ?? null,
      matchedEntries: matches.slice(0, 5),
    });
  }

  // 3) Negative media
  try {
    const media = await getNegativeMediaProvider().search({ subjectName: input.subjectName, entityType: "INDIVIDUAL" });
    if (media.outcome === "SUCCESS") {
      outcomes.push({
        type: "NEGATIVE_MEDIA",
        source: "NEGATIVE_MEDIA_PROVIDER",
        matchStatus: media.hits.length === 0 ? "NO_MATCH" : "POTENTIAL_MATCH",
        matchScore: media.hits[0]?.relevanceScore ?? null,
        matchedEntries: media.hits,
      });
    }
  } catch (err) {
    console.warn("[aml] Negative media screen unavailable, continuing:", (err as Error).message);
  }

  // Persist one immutable AMLScreening row per check.
  await prisma.aMLScreening.createMany({
    data: outcomes.map((o) => ({
      organizationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      applicationId: input.applicationId,
      subjectName: input.subjectName,
      screeningType: o.type,
      source: o.source as never,
      matchStatus: o.matchStatus,
      matchScore: o.matchScore,
      matchedEntries: (o.matchedEntries ?? undefined) as Prisma.InputJsonValue,
      screenedById: actor.userId,
    })),
  });

  const hits = outcomes.filter((o) => o.matchStatus !== "NO_MATCH");

  if (hits.length === 0) {
    await createAuditLog({
      organizationId,
      userId: actor.userId,
      action: "VERIFY",
      entity: "aml.screening",
      entityId: input.subjectId,
      description: `AML screening cleared for ${input.subjectName} — no matches across ${outcomes.length} check(s)`,
    });
    if (input.applicationId) {
      await workflow.completeAmlScreen({ applicationId: input.applicationId, organizationId, actor, detail: "No AML matches found" });
    }
    return { cleared: true, caseId: null, hits: [] };
  }

  // A hit was found — open (or reuse an existing open) case rather than auto-advancing.
  const worstLevel = hits.some((h) => h.matchStatus === "CONFIRMED_MATCH") ? "HIGH" : "MEDIUM";
  const existingCase = await prisma.aMLCase.findFirst({
    where: { organizationId, subjectType: input.subjectType, subjectId: input.subjectId, status: { in: ["OPEN", "UNDER_REVIEW", "ESCALATED"] } },
  });
  let amlCase = existingCase;
  if (!amlCase) {
    amlCase = await prisma.aMLCase.create({
      data: {
        organizationId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        subjectName: input.subjectName,
        applicationId: input.applicationId,
        caseNumber: await generateCaseNumber(organizationId),
        status: "OPEN",
        riskRating: worstLevel,
      },
    });
  }

  const alertTypeFor: Record<AMLScreeningType, AMLAlertType> = {
    PEP: "PEP_MATCH",
    SANCTIONS: "SANCTIONS_MATCH",
    NEGATIVE_MEDIA: "NEGATIVE_MEDIA_MATCH",
  };
  await prisma.aMLAlert.createMany({
    data: hits.map((h) => ({
      caseId: amlCase!.id,
      organizationId,
      alertType: alertTypeFor[h.type],
      severity: h.matchStatus === "CONFIRMED_MATCH" ? "HIGH" : "MEDIUM",
      description: `${h.type} match against ${h.source} (score ${h.matchScore ?? "n/a"})`,
    })),
  });

  await prisma.riskAssessment.create({
    data: {
      organizationId,
      subjectType: "AML_CASE",
      subjectId: amlCase.id,
      category: "AML_RISK",
      score: worstLevel === "HIGH" ? 85 : 55,
      level: worstLevel,
      factors: { hits: hits.map((h) => ({ type: h.type, source: h.source, matchStatus: h.matchStatus, matchScore: h.matchScore })) },
      computedBy: "RULE_ENGINE",
    },
  });

  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CREATE",
    entity: "aml.case",
    entityId: amlCase.id,
    description: `AML case ${amlCase.caseNumber} opened for ${input.subjectName} — ${hits.length} hit(s)`,
  });

  if (!existingCase) {
    await raiseAmlCaseAlert(organizationId, { id: amlCase.id, caseNumber: amlCase.caseNumber, subjectName: amlCase.subjectName, riskRating: amlCase.riskRating }).catch((err) =>
      console.warn("[aml] could not raise monitoring alert:", (err as Error).message)
    );
  }

  return { cleared: false, caseId: amlCase.id, hits };
}

export async function getScreeningsForSubject(organizationId: string, subjectType: string, subjectId: string) {
  return prisma.aMLScreening.findMany({
    where: { organizationId, subjectType: subjectType as never, subjectId },
    orderBy: { screenedAt: "desc" },
  });
}
