// ============================================================
// lib/financial-statements/schedule3-templates.ts
// Built-in Schedule III template structures (Companies Act 2013).
// Corporate = Part I (Balance Sheet) + Part II (P&L).
// Non-Corporate = simple format for partnerships / proprietors.
// ============================================================

import type { TemplateStructure } from "./types";

// ── CORPORATE BALANCE SHEET (Schedule III Part I) ─────────────
export const CORPORATE_BS_STRUCTURE: TemplateStructure = {
  sections: [
    {
      key: "bs.equity_liabilities",
      label: "EQUITY AND LIABILITIES",
      children: [
        {
          key: "bs.shareholders_funds",
          label: "Shareholders' Funds",
          children: [
            { key: "bs.sf.share_capital", label: "Share Capital", noteRef: 1, signConvention: "credit" },
            { key: "bs.sf.reserves_surplus", label: "Reserves and Surplus", noteRef: 2, signConvention: "credit" },
            { key: "bs.sf.money_received", label: "Money Received Against Share Warrants", noteRef: 3, signConvention: "credit" },
          ],
        },
        {
          key: "bs.share_app_money",
          label: "Share Application Money Pending Allotment",
          signConvention: "credit",
        },
        {
          key: "bs.minority_interest",
          label: "Minority Interest",
          signConvention: "credit",
        },
        {
          key: "bs.non_current_liabilities",
          label: "Non-Current Liabilities",
          children: [
            { key: "bs.ncl.long_term_borrowings", label: "Long-Term Borrowings", noteRef: 4, signConvention: "credit" },
            { key: "bs.ncl.deferred_tax", label: "Deferred Tax Liabilities (Net)", noteRef: 5, signConvention: "credit" },
            { key: "bs.ncl.other_long_term_liabilities", label: "Other Long-Term Liabilities", noteRef: 6, signConvention: "credit" },
            { key: "bs.ncl.long_term_provisions", label: "Long-Term Provisions", noteRef: 7, signConvention: "credit" },
          ],
        },
        {
          key: "bs.current_liabilities",
          label: "Current Liabilities",
          children: [
            { key: "bs.cl.short_term_borrowings", label: "Short-Term Borrowings", noteRef: 8, signConvention: "credit" },
            { key: "bs.cl.trade_payables", label: "Trade Payables", noteRef: 9, signConvention: "credit" },
            { key: "bs.cl.other_current_liabilities", label: "Other Current Liabilities", noteRef: 10, signConvention: "credit" },
            { key: "bs.cl.short_term_provisions", label: "Short-Term Provisions", noteRef: 11, signConvention: "credit" },
          ],
        },
        { key: "bs.total_equity_liabilities", label: "TOTAL", isTotal: true, signConvention: "credit" },
      ],
    },
    {
      key: "bs.assets",
      label: "ASSETS",
      children: [
        {
          key: "bs.non_current_assets",
          label: "Non-Current Assets",
          children: [
            {
              key: "bs.nca.fixed_assets",
              label: "Fixed Assets",
              children: [
                { key: "bs.nca.fa.tangible", label: "Tangible Assets", noteRef: 12, signConvention: "debit" },
                { key: "bs.nca.fa.intangible", label: "Intangible Assets", noteRef: 13, signConvention: "debit" },
                { key: "bs.nca.fa.capital_wip", label: "Capital Work-in-Progress", noteRef: 14, signConvention: "debit" },
                { key: "bs.nca.fa.intangible_dev", label: "Intangible Assets Under Development", noteRef: 15, signConvention: "debit" },
              ],
            },
            { key: "bs.nca.non_current_investments", label: "Non-Current Investments", noteRef: 16, signConvention: "debit" },
            { key: "bs.nca.deferred_tax_asset", label: "Deferred Tax Assets (Net)", noteRef: 17, signConvention: "debit" },
            { key: "bs.nca.long_term_loans", label: "Long-Term Loans and Advances", noteRef: 18, signConvention: "debit" },
            { key: "bs.nca.other_non_current", label: "Other Non-Current Assets", noteRef: 19, signConvention: "debit" },
          ],
        },
        {
          key: "bs.current_assets",
          label: "Current Assets",
          children: [
            { key: "bs.ca.current_investments", label: "Current Investments", noteRef: 20, signConvention: "debit" },
            { key: "bs.ca.inventories", label: "Inventories", noteRef: 21, signConvention: "debit" },
            { key: "bs.ca.trade_receivables", label: "Trade Receivables", noteRef: 22, signConvention: "debit" },
            { key: "bs.ca.cash_equivalents", label: "Cash and Cash Equivalents", noteRef: 23, signConvention: "debit" },
            { key: "bs.ca.short_term_loans", label: "Short-Term Loans and Advances", noteRef: 24, signConvention: "debit" },
            { key: "bs.ca.other_current", label: "Other Current Assets", noteRef: 25, signConvention: "debit" },
          ],
        },
        { key: "bs.total_assets", label: "TOTAL", isTotal: true, signConvention: "debit" },
      ],
    },
  ],
};

// ── CORPORATE P&L (Schedule III Part II) ──────────────────────
export const CORPORATE_PL_STRUCTURE: TemplateStructure = {
  sections: [
    {
      key: "pl.revenue",
      label: "I. Revenue",
      children: [
        { key: "pl.rev.from_operations", label: "Revenue from Operations", noteRef: 26, signConvention: "credit" },
        { key: "pl.rev.other_income", label: "Other Income", noteRef: 27, signConvention: "credit" },
        { key: "pl.rev.total", label: "Total Revenue (I)", isSubtotal: true, signConvention: "credit" },
      ],
    },
    {
      key: "pl.expenses",
      label: "II. Expenses",
      children: [
        { key: "pl.exp.cost_materials", label: "Cost of Materials Consumed", noteRef: 28, signConvention: "debit" },
        { key: "pl.exp.purchases_stock", label: "Purchases of Stock-in-Trade", noteRef: 29, signConvention: "debit" },
        { key: "pl.exp.changes_inventories", label: "Changes in Inventories of Finished Goods", noteRef: 30, signConvention: "debit" },
        { key: "pl.exp.employee_benefits", label: "Employee Benefit Expenses", noteRef: 31, signConvention: "debit" },
        { key: "pl.exp.finance_costs", label: "Finance Costs", noteRef: 32, signConvention: "debit" },
        { key: "pl.exp.depreciation", label: "Depreciation and Amortisation", noteRef: 33, signConvention: "debit" },
        { key: "pl.exp.other_expenses", label: "Other Expenses", noteRef: 34, signConvention: "debit" },
        { key: "pl.exp.total", label: "Total Expenses (II)", isSubtotal: true, signConvention: "debit" },
      ],
    },
    { key: "pl.profit_before_tax", label: "III. Profit Before Exceptional Items & Tax (I-II)", isSubtotal: true },
    { key: "pl.exceptional_items", label: "IV. Exceptional Items", noteRef: 35 },
    { key: "pl.profit_before_tax_exceptional", label: "V. Profit Before Tax (III-IV)", isSubtotal: true },
    {
      key: "pl.tax_expense",
      label: "VI. Tax Expense",
      children: [
        { key: "pl.tax.current", label: "Current Tax", signConvention: "debit" },
        { key: "pl.tax.deferred", label: "Deferred Tax", signConvention: "debit" },
      ],
    },
    { key: "pl.profit_after_tax", label: "VII. Profit for the Period (V-VI)", isTotal: true },
    {
      key: "pl.other_comprehensive_income",
      label: "VIII. Other Comprehensive Income",
      children: [
        { key: "pl.oci.items_reclassified", label: "Items reclassified to profit or loss" },
        { key: "pl.oci.items_not_reclassified", label: "Items not reclassified to profit or loss" },
      ],
    },
    { key: "pl.total_comprehensive_income", label: "IX. Total Comprehensive Income (VII+VIII)", isTotal: true },
    {
      key: "pl.eps",
      label: "X. Earnings Per Equity Share",
      children: [
        { key: "pl.eps.basic", label: "Basic EPS" },
        { key: "pl.eps.diluted", label: "Diluted EPS" },
      ],
    },
  ],
};

// ── CASH FLOW STATEMENT (Indirect Method) ─────────────────────
export const CASH_FLOW_STRUCTURE: TemplateStructure = {
  sections: [
    {
      key: "cf.operating",
      label: "A. Cash Flow from Operating Activities",
      children: [
        { key: "cf.op.net_profit", label: "Net Profit / (Loss) Before Tax" },
        {
          key: "cf.op.adjustments",
          label: "Adjustments for:",
          children: [
            { key: "cf.op.adj.depreciation", label: "Depreciation and Amortisation", signConvention: "debit" },
            { key: "cf.op.adj.interest", label: "Interest / Finance Costs", signConvention: "debit" },
            { key: "cf.op.adj.investment_income", label: "Investment Income", signConvention: "credit" },
            { key: "cf.op.adj.other", label: "Other Non-Cash Items" },
          ],
        },
        {
          key: "cf.op.working_capital",
          label: "Changes in Working Capital:",
          children: [
            { key: "cf.op.wc.trade_receivables", label: "Trade Receivables" },
            { key: "cf.op.wc.inventories", label: "Inventories" },
            { key: "cf.op.wc.trade_payables", label: "Trade Payables" },
            { key: "cf.op.wc.other", label: "Other Working Capital Changes" },
          ],
        },
        { key: "cf.op.tax_paid", label: "Income Tax Paid", signConvention: "credit" },
        { key: "cf.op.net", label: "Net Cash from Operating Activities (A)", isSubtotal: true },
      ],
    },
    {
      key: "cf.investing",
      label: "B. Cash Flow from Investing Activities",
      children: [
        { key: "cf.inv.capex", label: "Purchase of Fixed Assets", signConvention: "credit" },
        { key: "cf.inv.proceeds_assets", label: "Proceeds from Sale of Fixed Assets", signConvention: "debit" },
        { key: "cf.inv.investments_purchased", label: "Purchase of Investments", signConvention: "credit" },
        { key: "cf.inv.investments_sold", label: "Proceeds from Sale of Investments", signConvention: "debit" },
        { key: "cf.inv.interest_received", label: "Interest Received", signConvention: "debit" },
        { key: "cf.inv.dividends_received", label: "Dividends Received", signConvention: "debit" },
        { key: "cf.inv.net", label: "Net Cash from Investing Activities (B)", isSubtotal: true },
      ],
    },
    {
      key: "cf.financing",
      label: "C. Cash Flow from Financing Activities",
      children: [
        { key: "cf.fin.borrowings_raised", label: "Proceeds from Borrowings", signConvention: "debit" },
        { key: "cf.fin.borrowings_repaid", label: "Repayment of Borrowings", signConvention: "credit" },
        { key: "cf.fin.interest_paid", label: "Interest Paid", signConvention: "credit" },
        { key: "cf.fin.dividends_paid", label: "Dividends Paid", signConvention: "credit" },
        { key: "cf.fin.share_capital", label: "Proceeds from Issue of Share Capital", signConvention: "debit" },
        { key: "cf.fin.net", label: "Net Cash from Financing Activities (C)", isSubtotal: true },
      ],
    },
    { key: "cf.net_change", label: "Net Increase / (Decrease) in Cash (A+B+C)", isSubtotal: true },
    { key: "cf.opening_cash", label: "Cash and Cash Equivalents — Opening Balance" },
    { key: "cf.closing_cash", label: "Cash and Cash Equivalents — Closing Balance", isTotal: true },
  ],
};

// ── NON-CORPORATE BALANCE SHEET ────────────────────────────────
export const NON_CORPORATE_BS_STRUCTURE: TemplateStructure = {
  sections: [
    {
      key: "ncbs.capital_liabilities",
      label: "CAPITAL AND LIABILITIES",
      children: [
        { key: "ncbs.cl.capital", label: "Capital Account", signConvention: "credit" },
        { key: "ncbs.cl.reserves", label: "Reserves and Surplus", signConvention: "credit" },
        { key: "ncbs.cl.long_term_loans", label: "Long-Term Loans", noteRef: 1, signConvention: "credit" },
        { key: "ncbs.cl.short_term_loans", label: "Short-Term Loans", noteRef: 2, signConvention: "credit" },
        { key: "ncbs.cl.trade_creditors", label: "Trade Creditors", noteRef: 3, signConvention: "credit" },
        { key: "ncbs.cl.other_liabilities", label: "Other Liabilities", noteRef: 4, signConvention: "credit" },
        { key: "ncbs.cl.provisions", label: "Provisions", noteRef: 5, signConvention: "credit" },
        { key: "ncbs.total_liabilities", label: "TOTAL", isTotal: true, signConvention: "credit" },
      ],
    },
    {
      key: "ncbs.assets",
      label: "ASSETS",
      children: [
        { key: "ncbs.assets.fixed", label: "Fixed Assets", noteRef: 6, signConvention: "debit" },
        { key: "ncbs.assets.investments", label: "Investments", noteRef: 7, signConvention: "debit" },
        { key: "ncbs.assets.inventories", label: "Inventories / Stock-in-Trade", noteRef: 8, signConvention: "debit" },
        { key: "ncbs.assets.trade_debtors", label: "Trade Debtors", noteRef: 9, signConvention: "debit" },
        { key: "ncbs.assets.cash_bank", label: "Cash and Bank Balances", noteRef: 10, signConvention: "debit" },
        { key: "ncbs.assets.loans_advances", label: "Loans and Advances", noteRef: 11, signConvention: "debit" },
        { key: "ncbs.assets.other", label: "Other Assets", noteRef: 12, signConvention: "debit" },
        { key: "ncbs.total_assets", label: "TOTAL", isTotal: true, signConvention: "debit" },
      ],
    },
  ],
};

// ── NON-CORPORATE P&L ─────────────────────────────────────────
export const NON_CORPORATE_PL_STRUCTURE: TemplateStructure = {
  sections: [
    {
      key: "ncpl.income",
      label: "INCOME",
      children: [
        { key: "ncpl.inc.gross_sales", label: "Gross Sales / Turnover", signConvention: "credit" },
        { key: "ncpl.inc.returns", label: "Less: Returns", signConvention: "debit" },
        { key: "ncpl.inc.net_sales", label: "Net Sales", isSubtotal: true, signConvention: "credit" },
        { key: "ncpl.inc.other_income", label: "Other Income", signConvention: "credit" },
        { key: "ncpl.inc.total", label: "Total Income", isSubtotal: true, signConvention: "credit" },
      ],
    },
    {
      key: "ncpl.expenses",
      label: "EXPENSES",
      children: [
        { key: "ncpl.exp.opening_stock", label: "Opening Stock", signConvention: "debit" },
        { key: "ncpl.exp.purchases", label: "Purchases", signConvention: "debit" },
        { key: "ncpl.exp.direct_expenses", label: "Direct / Manufacturing Expenses", signConvention: "debit" },
        { key: "ncpl.exp.closing_stock", label: "Less: Closing Stock", signConvention: "credit" },
        { key: "ncpl.exp.gross_profit", label: "Gross Profit", isSubtotal: true },
        { key: "ncpl.exp.salaries", label: "Salaries and Wages", signConvention: "debit" },
        { key: "ncpl.exp.rent", label: "Rent", signConvention: "debit" },
        { key: "ncpl.exp.depreciation", label: "Depreciation", signConvention: "debit" },
        { key: "ncpl.exp.interest", label: "Interest Expense", signConvention: "debit" },
        { key: "ncpl.exp.other", label: "Other Expenses", signConvention: "debit" },
        { key: "ncpl.exp.total", label: "Total Expenses", isSubtotal: true, signConvention: "debit" },
      ],
    },
    { key: "ncpl.net_profit", label: "NET PROFIT / (LOSS)", isTotal: true },
  ],
};

// ── Template registry ──────────────────────────────────────────
export const BUILT_IN_TEMPLATES = [
  {
    name: "Schedule III — Corporate Balance Sheet",
    category: "CORPORATE" as const,
    statementType: "BALANCE_SHEET" as const,
    structure: CORPORATE_BS_STRUCTURE,
    description: "Companies Act 2013, Schedule III Part I — Balance Sheet",
  },
  {
    name: "Schedule III — Corporate Profit & Loss",
    category: "CORPORATE" as const,
    statementType: "PROFIT_LOSS" as const,
    structure: CORPORATE_PL_STRUCTURE,
    description: "Companies Act 2013, Schedule III Part II — Statement of P&L",
  },
  {
    name: "Cash Flow Statement — Indirect Method",
    category: "CORPORATE" as const,
    statementType: "CASH_FLOW" as const,
    structure: CASH_FLOW_STRUCTURE,
    description: "Indirect method cash flow per Ind AS 7 / AS 3",
  },
  {
    name: "Non-Corporate Balance Sheet",
    category: "NON_CORPORATE" as const,
    statementType: "BALANCE_SHEET" as const,
    structure: NON_CORPORATE_BS_STRUCTURE,
    description: "Simple balance sheet format for partnerships and proprietors",
  },
  {
    name: "Non-Corporate Profit & Loss",
    category: "NON_CORPORATE" as const,
    statementType: "PROFIT_LOSS" as const,
    structure: NON_CORPORATE_PL_STRUCTURE,
    description: "Simple P&L format for partnerships and proprietors",
  },
];

// ── Helper: flatten all keys from a template structure ─────────
export function flattenScheduleKeys(structure: TemplateStructure): Map<string, string> {
  const map = new Map<string, string>();
  function walk(nodes: typeof structure.sections) {
    for (const node of nodes) {
      map.set(node.key, node.label);
      if (node.children) walk(node.children);
    }
  }
  walk(structure.sections);
  return map;
}
