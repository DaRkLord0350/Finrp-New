// ============================================================
// Cash Flow Statement
// Operating: payments received - expenses paid
// Financing:  loan disbursements - loan repayments
// ============================================================

import { prisma } from "@/lib/prisma";
import { resolveDateRange } from "./filters";
import type { ReportFilters, ReportResult } from "./types";

interface CFRow {
  section: string;
  label:   string;
  amount:  number;
  flow:    "inflow" | "outflow";
}

export async function generateCashFlow(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<CFRow>> {
  const { startDate, endDate } = resolveDateRange(filters);

  const [paymentsIn, expensesOut, loansIn, loanPaymentsOut, bankAccounts] =
    await Promise.all([
      // Payments received (operating inflow)
      prisma.payment.aggregate({
        where: {
          organizationId,
          paidAt: { gte: startDate, lte: endDate },
          deletedAt: null,
        },
        _sum: { amount: true },
      }),

      // Expenses paid (operating outflow)
      prisma.expense.aggregate({
        where: {
          organizationId,
          expenseDate: { gte: startDate, lte: endDate },
          deletedAt: null,
        },
        _sum: { amount: true },
      }),

      // Loan disbursements (financing inflow)
      prisma.loan.aggregate({
        where: {
          organizationId,
          status: { in: ["ACTIVE", "APPROVED"] },
          startDate: { gte: startDate, lte: endDate },
        },
        _sum: { disbursedAmount: true },
      }),

      // Loan EMI repayments (financing outflow)
      prisma.loanPayment.aggregate({
        where: {
          loan: { organizationId },
          paidDate: { gte: startDate, lte: endDate },
          status: "PAID",
        },
        _sum: { paidAmount: true },
      }),

      // Opening bank balances (reference)
      prisma.bankAccount.aggregate({
        where: { organizationId, deletedAt: null },
        _sum: { openingBalance: true, currentBalance: true },
      }),
    ]);

  const operatingInflow  = Number(paymentsIn._sum.amount ?? 0);
  const operatingOutflow = Number(expensesOut._sum.amount ?? 0);
  const operatingNet     = operatingInflow - operatingOutflow;

  const financingInflow  = Number(loansIn._sum.disbursedAmount ?? 0);
  const financingOutflow = Number(loanPaymentsOut._sum.paidAmount ?? 0);
  const financingNet     = financingInflow - financingOutflow;

  const netCashFlow = operatingNet + financingNet;

  const rows: CFRow[] = [
    { section: "Operating Activities",  label: "Payments Received from Customers", amount: operatingInflow,  flow: "inflow"  },
    { section: "Operating Activities",  label: "Payments Made for Expenses",       amount: operatingOutflow, flow: "outflow" },
    { section: "Financing Activities",  label: "Loan Disbursements",               amount: financingInflow,  flow: "inflow"  },
    { section: "Financing Activities",  label: "Loan Repayments (EMI)",            amount: financingOutflow, flow: "outflow" },
  ];

  return {
    slug:        "cash-flow",
    name:        "Cash Flow Statement",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      operatingNet,
      financingNet,
      netCashFlow,
      openingBalance: Number(bankAccounts._sum.openingBalance ?? 0),
      closingBalance:  Number(bankAccounts._sum.currentBalance ?? 0),
    },
    columns: [
      { key: "section", label: "Section",     type: "text" },
      { key: "label",   label: "Description", type: "text" },
      { key: "amount",  label: "Amount",      type: "currency", align: "right", sortable: true },
      { key: "flow",    label: "Flow",        type: "badge" },
    ],
    rows,
    totals: {
      operatingNet,
      financingNet,
      netCashFlow,
    },
    charts: [
      {
        type:  "bar",
        title: "Cash Flow by Section",
        data:  [
          { name: "Operating", value: operatingNet  },
          { name: "Financing", value: financingNet  },
          { name: "Net",       value: netCashFlow   },
        ],
        xKey:  "name",
        yKeys: ["value"],
      },
    ],
  };
}
