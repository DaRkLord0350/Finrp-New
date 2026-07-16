// ============================================================
// lib/fraud/service.ts
//
// Orchestrates a fraud screen: records the identity/device fingerprint
// (append-only ledger), runs duplicate-PAN / duplicate-Aadhaar /
// velocity checks against that ledger, checks the blacklist, pulls IP
// intelligence (optional signal, degrades gracefully if unconfigured),
// and computes a rules-engine fraud score.
//
// Same "a hit blocks, doesn't auto-clear" philosophy as AML
// (lib/aml/service.ts): only a clean LOW/MEDIUM score with no
// blacklist hit auto-advances the loan's FRAUD pipeline stage. A
// HIGH/CRITICAL score or blacklist hit opens a FraudCase instead.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { FraudAlertType, FraudSubjectType, Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { computeFraudScore, type FraudSignals } from "./core/rules-engine";
import { checkBlacklist } from "./list-service";
import { getIpIntelligenceProvider } from "./ip-intelligence";
import * as workflow from "@/lib/lending/workflow/service";
import { raiseFraudCaseAlert } from "@/lib/monitoring/service";

const DUPLICATE_LOOKBACK_DAYS = 90;
const VELOCITY_LOOKBACK_DAYS = 30;

export interface ScreenApplicationInput {
  subjectType: FraudSubjectType;
  subjectId: string;
  subjectName: string;
  applicationId?: string;
  pan?: string;
  /** Pre-hashed by the caller (client-side SubtleCrypto or a trusted server step) — this service never accepts a raw Aadhaar number. */
  aadhaarHash?: string;
  email?: string;
  phone?: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

async function generateCaseNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.fraudCase.count({ where: { organizationId } });
  return `FR${year}${String(count + 1).padStart(6, "0")}`;
}

export async function screenApplication(organizationId: string, input: ScreenApplicationInput, actor: { userId: string; role?: string }) {
  await prisma.fraudIdentityFingerprint.create({
    data: {
      organizationId,
      applicationId: input.applicationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      pan: input.pan,
      aadhaarHash: input.aadhaarHash,
      email: input.email,
      phone: input.phone,
      deviceFingerprint: input.deviceFingerprint,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  });

  const duplicateLookback = daysAgo(DUPLICATE_LOOKBACK_DAYS);
  const velocityLookback = daysAgo(VELOCITY_LOOKBACK_DAYS);

  const [duplicatePanCount, duplicateAadhaarCount, deviceVelocity, ipVelocity, blacklistHit] = await Promise.all([
    input.pan
      ? prisma.fraudIdentityFingerprint.count({ where: { organizationId, pan: input.pan, applicationId: { not: input.applicationId ?? undefined }, capturedAt: { gte: duplicateLookback } } })
      : Promise.resolve(0),
    input.aadhaarHash
      ? prisma.fraudIdentityFingerprint.count({ where: { organizationId, aadhaarHash: input.aadhaarHash, applicationId: { not: input.applicationId ?? undefined }, capturedAt: { gte: duplicateLookback } } })
      : Promise.resolve(0),
    input.deviceFingerprint
      ? prisma.fraudIdentityFingerprint.count({ where: { organizationId, deviceFingerprint: input.deviceFingerprint, applicationId: { not: input.applicationId ?? undefined }, capturedAt: { gte: velocityLookback } } })
      : Promise.resolve(0),
    input.ipAddress
      ? prisma.fraudIdentityFingerprint.count({ where: { organizationId, ipAddress: input.ipAddress, applicationId: { not: input.applicationId ?? undefined }, capturedAt: { gte: velocityLookback } } })
      : Promise.resolve(0),
    checkBlacklist(organizationId, { pan: input.pan, aadhaarHash: input.aadhaarHash, email: input.email, phone: input.phone, deviceFingerprint: input.deviceFingerprint, ipAddress: input.ipAddress }),
  ]);

  let ipRiskScore: number | undefined;
  if (input.ipAddress) {
    try {
      const ipResult = await getIpIntelligenceProvider().lookup({ ipAddress: input.ipAddress });
      if (ipResult.outcome === "SUCCESS") ipRiskScore = ipResult.riskScore;
    } catch (err) {
      console.warn("[fraud] IP intelligence unavailable, continuing without it:", (err as Error).message);
    }
  }

  const signals: FraudSignals = {
    duplicatePanCount,
    duplicateAadhaarCount,
    velocityCount: Math.max(deviceVelocity, ipVelocity),
    blacklistHit,
    ipRiskScore,
  };
  const result = computeFraudScore(signals);

  await prisma.fraudScore.create({
    data: {
      organizationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      applicationId: input.applicationId,
      score: result.score,
      riskLevel: result.level,
      factors: result.factors as unknown as Prisma.InputJsonValue,
    },
  });
  await prisma.riskAssessment.create({
    data: {
      organizationId,
      subjectType: input.applicationId ? "LOAN_APPLICATION" : "CUSTOMER",
      subjectId: input.applicationId ?? input.subjectId,
      category: "FRAUD_RISK",
      score: result.score,
      level: result.level,
      factors: result.factors as unknown as Prisma.InputJsonValue,
      computedBy: "RULE_ENGINE",
    },
  });

  const needsCase = result.level === "HIGH" || result.level === "CRITICAL" || blacklistHit;

  if (!needsCase) {
    await createAuditLog({
      organizationId,
      userId: actor.userId,
      action: "VERIFY",
      entity: "fraud.screening",
      entityId: input.subjectId,
      description: `Fraud screening cleared for ${input.subjectName} — score ${result.score} (${result.level})`,
    });
    if (input.applicationId) {
      await workflow.completeFraudCheck({ applicationId: input.applicationId, organizationId, actor, detail: `Fraud score ${result.score} (${result.level})` });
    }
    return { cleared: true, caseId: null, score: result };
  }

  const existingCase = await prisma.fraudCase.findFirst({
    where: { organizationId, subjectType: input.subjectType, subjectId: input.subjectId, status: { in: ["OPEN", "UNDER_REVIEW", "ESCALATED"] } },
  });
  let fraudCase = existingCase;
  if (!fraudCase) {
    fraudCase = await prisma.fraudCase.create({
      data: {
        organizationId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        subjectName: input.subjectName,
        applicationId: input.applicationId,
        caseNumber: await generateCaseNumber(organizationId),
        status: "OPEN",
        riskRating: result.level,
      },
    });
  }

  const alerts: { alertType: FraudAlertType; description: string }[] = [];
  if (blacklistHit) alerts.push({ alertType: "BLACKLIST_HIT", description: "Subject matched an active blacklist entry" });
  if (duplicatePanCount > 0) alerts.push({ alertType: "DUPLICATE_PAN", description: `PAN appears on ${duplicatePanCount} other application(s) in the last ${DUPLICATE_LOOKBACK_DAYS} days` });
  if (duplicateAadhaarCount > 0) alerts.push({ alertType: "DUPLICATE_AADHAAR", description: `Aadhaar appears on ${duplicateAadhaarCount} other application(s) in the last ${DUPLICATE_LOOKBACK_DAYS} days` });
  if (signals.velocityCount >= 3) alerts.push({ alertType: "VELOCITY_BREACH", description: `${signals.velocityCount} application(s) from the same device/IP in the last ${VELOCITY_LOOKBACK_DAYS} days` });
  if (ipRiskScore !== undefined && ipRiskScore >= 60) alerts.push({ alertType: "IP_RISK", description: `IP risk score ${ipRiskScore}/100 (VPN/proxy/datacenter likelihood)` });

  if (alerts.length > 0) {
    await prisma.fraudAlert.createMany({
      data: alerts.map((a) => ({ caseId: fraudCase!.id, organizationId, alertType: a.alertType, severity: result.level, description: a.description })),
    });
  }

  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CREATE",
    entity: "fraud.case",
    entityId: fraudCase.id,
    description: `Fraud case ${fraudCase.caseNumber} opened for ${input.subjectName} — score ${result.score} (${result.level})`,
  });

  if (!existingCase) {
    await raiseFraudCaseAlert(organizationId, { id: fraudCase.id, caseNumber: fraudCase.caseNumber, subjectName: fraudCase.subjectName, riskRating: fraudCase.riskRating }).catch((err) =>
      console.warn("[fraud] could not raise monitoring alert:", (err as Error).message)
    );
  }

  return { cleared: false, caseId: fraudCase.id, score: result };
}

export async function getFraudScoreHistory(organizationId: string, subjectType: string, subjectId: string) {
  return prisma.fraudScore.findMany({ where: { organizationId, subjectType: subjectType as never, subjectId }, orderBy: { computedAt: "desc" } });
}
