// ============================================================
// lib/financial-statements/types.ts
// Shared TypeScript types for the Financial Reporting Engine.
// ============================================================

// Mirror Prisma enums locally so this file is client-safe and
// doesn't depend on the Prisma runtime being available.
export type StatementType = "BALANCE_SHEET" | "PROFIT_LOSS" | "CASH_FLOW" | "TRIAL_BALANCE" | "NOTES";
export type StatementStatus = "DRAFT" | "REVIEW" | "APPROVED" | "LOCKED" | "PUBLISHED";
export type TemplateCategory = "CORPORATE" | "NON_CORPORATE";
export type MappingSource = "AI_AUTO" | "AI_CONFIRMED" | "MANUAL" | "INHERITED";
export type AdjJournalStatus = "DRAFT" | "POSTED" | "REVERSED";
export type ExportFormat = "PDF" | "EXCEL" | "BOTH";
export type ExportStatus = "PENDING" | "GENERATING" | "READY" | "FAILED";
export type ConsolidationStatus = "DRAFT" | "PROCESSING" | "COMPLETED" | "FAILED";

// ── Schedule III tree node ─────────────────────────────────────
export interface ScheduleNode {
  key: string;
  label: string;
  noteRef?: number;
  children?: ScheduleNode[];
  isSubtotal?: boolean;
  isTotal?: boolean;
  signConvention?: "debit" | "credit";
}

// ── Template structure (stored as JSON in StatementTemplate.structure) ─
export interface TemplateStructure {
  sections: ScheduleNode[];
}

// ── Computed line item (after applying GL balances + adjustments) ─
export interface ComputedLineItem {
  key: string;
  label: string;
  amount: number;
  comparativeAmount?: number;
  noteRef?: number;
  isSubtotal?: boolean;
  isTotal?: boolean;
  children?: ComputedLineItem[];
}

// ── Full computed report output (stored in FinancialSnapshot.data) ─
export interface ComputedReport {
  reportId: string;
  statementType: StatementType;
  periodStart: string;
  periodEnd: string;
  comparativeStart?: string;
  comparativeEnd?: string;
  currency: string;
  sections: ComputedLineItem[];
  includesAdjustments: boolean;
  computedAt: string;
  balanced?: boolean;
  totalDebit?: number;
  totalCredit?: number;
}

// ── AI mapping suggestion ──────────────────────────────────────
export interface AIMappingSuggestion {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  suggestedKey: string;
  suggestedName: string;
  confidence: number;
  rationale: string;
}

// ── Validation result ──────────────────────────────────────────
export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  affectedKeys?: string[];
  amount?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
  summary: string;
}

// ── Statement period helper ────────────────────────────────────
export interface StatementPeriod {
  fiscalYearId: string;
  fiscalYearName: string;
  periodStart: Date;
  periodEnd: Date;
  comparativeStart?: Date;
  comparativeEnd?: Date;
}

// ── Adjustment journal line ────────────────────────────────────
export interface AdjEntryInput {
  accountId: string;
  scheduleKey: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
  description?: string;
}

// ── Note content block ─────────────────────────────────────────
export interface NoteBlock {
  label: string;
  currentAmount: number;
  comparativeAmount?: number;
  subItems?: Array<{
    label: string;
    currentAmount: number;
    comparativeAmount?: number;
  }>;
}

// ── Export request ─────────────────────────────────────────────
export interface ExportRequest {
  reportId: string;
  format: ExportFormat;
  includeSignaturePlaceholder?: boolean;
  includeNotes?: boolean;
  includeAdjustments?: boolean;
}

// ── Consolidation input ────────────────────────────────────────
export interface ConsolidationInput {
  parentOrganizationId: string;
  childOrganizationIds: string[];
  statementType: StatementType;
  periodStart: Date;
  periodEnd: Date;
}
