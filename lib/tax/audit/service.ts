// ============================================================
// lib/tax/audit/service.ts
//
// Audit report generation via a single REUSABLE pipeline. Each form
// (3CA/3CB/3CD/10B/29B/29C/3CEB) registers a builder that turns the
// org's financials + supplied particulars into a structured report.
// Reports carry a UDIN and a DRAFT → APPROVED review status.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { AuditReportForm, Prisma } from "@prisma/client";
import { assessmentYearOf } from "../core/period";
import { toNumber } from "../core/money";
import { getFinancialStatements } from "../financials/service";

export interface ReportSection {
  title: string;
  rows: { label: string; value: string | number }[];
}
export interface BuiltReport {
  title: string;
  form: AuditReportForm;
  sections: ReportSection[];
}

interface BuildContext {
  financialYear: string;
  assessmentYear: string;
  financials: { turnover: number; netProfit: number; totalAssets: number } | null;
  particulars: Record<string, unknown>;
}

const p = (ctx: BuildContext, key: string, dflt = "—") => {
  const v = ctx.particulars[key];
  return v === undefined || v === null || v === "" ? dflt : String(v);
};

type Builder = (ctx: BuildContext) => BuiltReport;

// ── Reusable section helpers ──────────────────────────────────
function auditeeSection(ctx: BuildContext): ReportSection {
  return {
    title: "Auditee particulars",
    rows: [
      { label: "Name of assessee", value: p(ctx, "assesseeName") },
      { label: "PAN", value: p(ctx, "pan") },
      { label: "Financial year", value: ctx.financialYear },
      { label: "Assessment year", value: ctx.assessmentYear },
      { label: "Status", value: p(ctx, "status", "Company") },
    ],
  };
}

function financialsSection(ctx: BuildContext): ReportSection {
  return {
    title: "Financial summary",
    rows: [
      { label: "Turnover / gross receipts", value: ctx.financials?.turnover ?? 0 },
      { label: "Net profit / (loss)", value: ctx.financials?.netProfit ?? 0 },
      { label: "Total assets", value: ctx.financials?.totalAssets ?? 0 },
    ],
  };
}

// ── Form builders ─────────────────────────────────────────────
const FORM_REGISTRY: Record<AuditReportForm, Builder> = {
  FORM_3CA: (ctx) => ({
    title: "Form 3CA — Audit report (audited under another law)",
    form: "FORM_3CA",
    sections: [
      auditeeSection(ctx),
      { title: "Audit reference", rows: [
        { label: "Statutory audit conducted under", value: p(ctx, "statuteName", "Companies Act, 2013") },
        { label: "Auditor", value: p(ctx, "auditorName") },
        { label: "Membership no.", value: p(ctx, "membershipNo") },
      ] },
      financialsSection(ctx),
    ],
  }),
  FORM_3CB: (ctx) => ({
    title: "Form 3CB — Audit report (not audited under any other law)",
    form: "FORM_3CB",
    sections: [
      auditeeSection(ctx),
      { title: "Audit observations", rows: [
        { label: "Books examined", value: p(ctx, "booksExamined", "Cash book, ledger, journal") },
        { label: "Branch", value: p(ctx, "branch", "Head office") },
        { label: "Qualifications / comments", value: p(ctx, "qualifications", "None") },
      ] },
      financialsSection(ctx),
    ],
  }),
  FORM_3CD: (ctx) => ({
    title: "Form 3CD — Statement of particulars",
    form: "FORM_3CD",
    sections: [
      auditeeSection(ctx),
      { title: "Clause 8–13: nature of business & books", rows: [
        { label: "Cl.8 Nature of business", value: p(ctx, "natureOfBusiness") },
        { label: "Cl.11 Books of account", value: p(ctx, "books", "Maintained in electronic form") },
        { label: "Cl.13 Method of accounting", value: p(ctx, "accountingMethod", "Mercantile") },
      ] },
      { title: "Clause 17–21: income & expenditure", rows: [
        { label: "Cl.18 Depreciation allowable", value: p(ctx, "depreciation", "As per Annexure") },
        { label: "Cl.21 Amounts debited but inadmissible", value: p(ctx, "inadmissible", "Nil") },
      ] },
      { title: "Clause 26–34: statutory compliance", rows: [
        { label: "Cl.26 Sums u/s 43B", value: p(ctx, "section43B", "Paid before due date") },
        { label: "Cl.34 TDS compliance", value: p(ctx, "tdsCompliance", "Compliant") },
        { label: "Cl.40 Turnover", value: ctx.financials?.turnover ?? 0 },
        { label: "Cl.40 Net profit ratio", value: p(ctx, "netProfitRatio") },
      ] },
    ],
  }),
  FORM_10B: (ctx) => ({
    title: "Form 10B — Audit report (charitable / religious trust)",
    form: "FORM_10B",
    sections: [
      auditeeSection(ctx),
      { title: "Application of income", rows: [
        { label: "Total income", value: ctx.financials?.turnover ?? 0 },
        { label: "Applied to objects (85%)", value: p(ctx, "appliedIncome") },
        { label: "Accumulated u/s 11(2)", value: p(ctx, "accumulated", "Nil") },
      ] },
    ],
  }),
  FORM_29B: (ctx) => ({
    title: "Form 29B — Report u/s 115JB (MAT, companies)",
    form: "FORM_29B",
    sections: [
      auditeeSection(ctx),
      { title: "Book profit computation", rows: [
        { label: "Net profit as per P&L", value: ctx.financials?.netProfit ?? 0 },
        { label: "Add: provisions / adjustments", value: p(ctx, "matAdditions", "Nil") },
        { label: "Book profit u/s 115JB", value: p(ctx, "bookProfit") },
        { label: "MAT @ 15%", value: p(ctx, "matTax") },
      ] },
    ],
  }),
  FORM_29C: (ctx) => ({
    title: "Form 29C — Report u/s 115JC (AMT, non-companies)",
    form: "FORM_29C",
    sections: [
      auditeeSection(ctx),
      { title: "Adjusted total income", rows: [
        { label: "Total income", value: ctx.financials?.netProfit ?? 0 },
        { label: "Add: deductions claimed", value: p(ctx, "amtAdditions", "Nil") },
        { label: "Adjusted total income", value: p(ctx, "adjustedTotalIncome") },
        { label: "AMT @ 18.5%", value: p(ctx, "amtTax") },
      ] },
    ],
  }),
  FORM_3CEB: (ctx) => ({
    title: "Form 3CEB — Report u/s 92E (transfer pricing)",
    form: "FORM_3CEB",
    sections: [
      auditeeSection(ctx),
      { title: "International / specified domestic transactions", rows: [
        { label: "Associated enterprises", value: p(ctx, "associatedEnterprises") },
        { label: "Aggregate value of transactions", value: p(ctx, "transactionValue") },
        { label: "Method applied", value: p(ctx, "tpMethod", "TNMM") },
      ] },
    ],
  }),
};

export function listAuditForms(): { form: AuditReportForm; title: string }[] {
  return (Object.keys(FORM_REGISTRY) as AuditReportForm[]).map((form) => ({
    form,
    title: FORM_REGISTRY[form]({ financialYear: "", assessmentYear: "", financials: null, particulars: {} }).title,
  }));
}

export async function generateAuditReport(params: {
  organizationId: string;
  formType: AuditReportForm;
  financialYear: string;
  particulars?: Record<string, unknown>;
  generatedById?: string;
}) {
  const { organizationId, formType, financialYear } = params;
  const assessmentYear = assessmentYearOf(financialYear);

  const fin = await getFinancialStatements(organizationId, financialYear);
  const financials = fin.profitAndLoss || fin.balanceSheet
    ? {
        turnover: toNumber((fin.profitAndLoss?.payload as { totalIncome?: number } | undefined)?.totalIncome ?? 0),
        netProfit: toNumber(fin.profitAndLoss?.netProfit ?? 0),
        totalAssets: toNumber(fin.balanceSheet?.totalAssets ?? 0),
      }
    : null;

  const built = FORM_REGISTRY[formType]({ financialYear, assessmentYear, financials, particulars: params.particulars ?? {} });

  const report = await prisma.auditReport.upsert({
    where: { organizationId_formType_financialYear: { organizationId, formType, financialYear } },
    create: {
      organizationId, formType, financialYear, assessmentYear,
      status: "DRAFT", data: built as unknown as Prisma.InputJsonValue, generatedById: params.generatedById,
    },
    update: { data: built as unknown as Prisma.InputJsonValue, assessmentYear, generatedById: params.generatedById },
  });

  return { report, built };
}

export async function listAuditReports(organizationId: string, financialYear?: string) {
  return prisma.auditReport.findMany({
    where: { organizationId, deletedAt: null, ...(financialYear ? { financialYear } : {}) },
    orderBy: { updatedAt: "desc" },
  });
}

/** Review checkpoint: a tax.approve holder signs the report with a UDIN. */
export async function approveAuditReport(params: { organizationId: string; id: string; udin: string }) {
  const report = await prisma.auditReport.findFirst({ where: { id: params.id, organizationId: params.organizationId } });
  if (!report) throw new Error("Audit report not found");
  return prisma.auditReport.update({ where: { id: report.id }, data: { status: "APPROVED", udin: params.udin } });
}
