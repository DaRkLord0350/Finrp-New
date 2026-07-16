// ============================================================
// lib/aml/core/risk-factors.ts
//
// Country / Occupation / Industry risk seed data + lookup, backing
// AMLRiskFactorRating. Two different confidence levels, deliberately:
//
//   - FATF "Call for Action" (blacklist) is short and stable across
//     long periods (DPRK, Iran, Myanmar) — seeded here with
//     confidence.
//   - FATF "Increased Monitoring" (greylist) changes at every FATF
//     plenary (~3x/year) and is NOT seeded here with a hardcoded
//     country list — this file's knowledge has a training cutoff and
//     asserting a specific greylist as current would be presenting
//     stale data as fact. The AMLRiskFactorRating table (and its
//     admin UI) is the mechanism; populating/maintaining the greylist
//     against FATF's live published list is an operator
//     responsibility, called out explicitly below.
//   - Occupation/Industry risk follow FATF Recommendation 22/23
//     (DNFBP guidance) — stable, foundational AML doctrine, not a
//     volatile list, so seeded with confidence.
// ============================================================

import type { RiskLevel } from "@prisma/client";

export interface RiskFactorSeed {
  code: string;
  label: string;
  riskLevel: RiskLevel;
  source: string;
}

/**
 * FATF "High-Risk Jurisdictions subject to a Call for Action" — the
 * short, stable blacklist. Verify against https://www.fatf-gafi.org
 * before relying on this in production; FATF can and does update even
 * this list, just far less often than the greylist.
 */
export const FATF_BLACKLIST_SEED: RiskFactorSeed[] = [
  { code: "KP", label: "North Korea (DPRK)", riskLevel: "CRITICAL", source: "FATF_BLACKLIST" },
  { code: "IR", label: "Iran", riskLevel: "CRITICAL", source: "FATF_BLACKLIST" },
  { code: "MM", label: "Myanmar", riskLevel: "HIGH", source: "FATF_BLACKLIST" },
];

/**
 * Standard AML occupation risk categories per FATF Recommendation 22/23
 * guidance on PEPs and DNFBPs. Not exhaustive — a rules engine should
 * treat unmatched occupations as MEDIUM (unknown != low-risk) rather
 * than silently passing them through.
 */
export const OCCUPATION_RISK_SEED: RiskFactorSeed[] = [
  { code: "GOVERNMENT_OFFICIAL", label: "Government Official", riskLevel: "HIGH", source: "FATF_R22" },
  { code: "JUDICIARY", label: "Judge / Judiciary", riskLevel: "HIGH", source: "FATF_R22" },
  { code: "MILITARY_SENIOR", label: "Senior Military Officer", riskLevel: "HIGH", source: "FATF_R22" },
  { code: "POLITICAL_PARTY_OFFICIAL", label: "Senior Political Party Official", riskLevel: "HIGH", source: "FATF_R22" },
  { code: "SOE_EXECUTIVE", label: "State-Owned Enterprise Executive", riskLevel: "HIGH", source: "FATF_R22" },
  { code: "DIPLOMAT", label: "Diplomat / Foreign Mission Official", riskLevel: "HIGH", source: "FATF_R22" },
  { code: "LAWYER", label: "Lawyer / Notary (DNFBP)", riskLevel: "MEDIUM", source: "FATF_R23" },
  { code: "ACCOUNTANT", label: "Accountant / Auditor (DNFBP)", riskLevel: "MEDIUM", source: "FATF_R23" },
  { code: "REAL_ESTATE_AGENT", label: "Real Estate Agent (DNFBP)", riskLevel: "MEDIUM", source: "FATF_R23" },
  { code: "SALARIED_EMPLOYEE", label: "Salaried Employee (private sector)", riskLevel: "LOW", source: "INTERNAL" },
  { code: "SELF_EMPLOYED", label: "Self-Employed / Business Owner", riskLevel: "MEDIUM", source: "INTERNAL" },
];

/** Standard AML high-risk industries per FATF DNFBP + cash-intensive-business guidance. */
export const INDUSTRY_RISK_SEED: RiskFactorSeed[] = [
  { code: "MONEY_SERVICE_BUSINESS", label: "Money Service Business / Remittance", riskLevel: "CRITICAL", source: "FATF_R22" },
  { code: "CASINO_GAMING", label: "Casino / Gaming", riskLevel: "CRITICAL", source: "FATF_R22" },
  { code: "PRECIOUS_METALS_STONES", label: "Precious Metals / Stones Dealer", riskLevel: "HIGH", source: "FATF_R22" },
  { code: "REAL_ESTATE", label: "Real Estate", riskLevel: "HIGH", source: "FATF_R22" },
  { code: "VIRTUAL_ASSETS", label: "Virtual Asset Service Provider", riskLevel: "HIGH", source: "FATF_R15" },
  { code: "ART_DEALER", label: "Art / Antiques Dealer", riskLevel: "MEDIUM", source: "FATF_R22" },
  { code: "USED_VEHICLE_DEALER", label: "Used Vehicle Dealer", riskLevel: "MEDIUM", source: "INTERNAL" },
  { code: "IMPORT_EXPORT", label: "Import / Export Trading", riskLevel: "MEDIUM", source: "INTERNAL" },
  { code: "RETAIL", label: "Retail Trade", riskLevel: "LOW", source: "INTERNAL" },
  { code: "IT_SERVICES", label: "IT / Software Services", riskLevel: "LOW", source: "INTERNAL" },
  { code: "MANUFACTURING", label: "Manufacturing", riskLevel: "LOW", source: "INTERNAL" },
];

export function defaultRiskLevelForUnknown(): RiskLevel {
  return "MEDIUM"; // unknown/unclassified is treated as elevated, never as low-risk by default
}
