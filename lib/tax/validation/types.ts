// ============================================================
// lib/tax/validation/types.ts
//
// Contracts for the configurable validation framework. A RULE pairs a
// stable `code` + severity + blocking flag (stored in the DB and/or a
// code default) with a HANDLER (a pure function keyed by handlerKey).
// The engine runs handlers, stamps each emitted issue with the rule's
// metadata, and persists a TaxValidationRun + findings.
// ============================================================

import type { TaxScheme, TaxValidationSeverity } from "@prisma/client";
import type { TaxRuleSet } from "../config/types";

/** A single problem emitted by a handler (severity/code stamped by engine). */
export interface RuleIssue {
  message: string;
  field?: string;
  pointer?: string; // path to the offending record/line
  value?: unknown;
  explanation?: string;
}

export interface RuleContext<S = unknown> {
  subject: S;
  params: Record<string, unknown>;
  config: TaxRuleSet;
  organizationId: string;
  period?: string;
}

export type RuleHandler<S = unknown> = (ctx: RuleContext<S>) => RuleIssue[] | Promise<RuleIssue[]>;

/** Code-level default rule definition (seeds DB + works with zero config). */
export interface RuleDefinition {
  code: string;
  scheme: TaxScheme;
  name: string;
  description?: string;
  explanation?: string;
  severity: TaxValidationSeverity;
  blocking: boolean;
  handlerKey: string;
  params?: Record<string, unknown>;
}

/** A finding after the engine stamps a handler issue with rule metadata. */
export interface StampedFinding extends RuleIssue {
  ruleCode: string;
  severity: TaxValidationSeverity;
  blocking: boolean;
}

export interface ValidationOutcome {
  runId: string | null;
  passed: boolean;
  blocked: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  findings: StampedFinding[];
}
