// ============================================================
// FinRP — ERP Service Layer
// Real metric calculations from database
// ============================================================

import { prisma } from "@/lib/prisma";
import type {
  ERPMetrics,
  ERPOperations,
  ERPAlert,
  ERPSuggestion,
  ERPProject,
  ERPDashboardData,
} from "@/types/erp";

// ─── Helper: Get current month date range ───────────────────
function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

function getLastMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  return { start, end };
}

// ─── Core Metric Functions ──────────────────────────────────

export const erpService = {

  /**
   * Revenue MTD — SUM(Sales.totalAmount WHERE current_month)
   */
  async getRevenueMTD(orgId: string): Promise<number> {
    const { start, end } = getCurrentMonthRange();
    const sales = await prisma.sale.findMany({
      where: {
        organizationId: orgId,
        status: "COMPLETED",
        saleDate: { gte: start, lte: end },
      },
      select: { totalAmount: true },
    });
    return sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  },

  /**
   * Revenue from last month for growth calculation
   */
  async getRevenueLastMonth(orgId: string): Promise<number> {
    const { start, end } = getLastMonthRange();
    const sales = await prisma.sale.findMany({
      where: {
        organizationId: orgId,
        status: "COMPLETED",
        saleDate: { gte: start, lte: end },
      },
      select: { totalAmount: true },
    });
    return sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  },

  /**
   * Total expenses for current month
   */
  async getExpensesMTD(orgId: string): Promise<number> {
    const { start, end } = getCurrentMonthRange();
    const expenses = await prisma.expense.findMany({
      where: {
        organizationId: orgId,
        expenseDate: { gte: start, lte: end },
      },
      select: { amount: true },
    });
    return expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  },

  /**
   * Total payroll for current month
   */
  async getPayrollMTD(orgId: string): Promise<number> {
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const payroll = await prisma.payroll.findMany({
      where: {
        organizationId: orgId,
        payPeriod: currentPeriod,
      },
      select: { netPay: true },
    });
    return payroll.reduce((sum, p) => sum + Number(p.netPay), 0);
  },

  /**
   * Total purchases for current month
   */
  async getPurchasesMTD(orgId: string): Promise<number> {
    const { start, end } = getCurrentMonthRange();
    const purchases = await prisma.purchase.findMany({
      where: {
        organizationId: orgId,
        status: "RECEIVED",
        purchaseDate: { gte: start, lte: end },
      },
      select: { totalAmount: true },
    });
    return purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
  },

  /**
   * Inventory value — SUM(Item.price * Item.stock)
   */
  async getInventoryValue(orgId: string): Promise<number> {
    const items = await prisma.item.findMany({
      where: { organizationId: orgId },
      select: { price: true, stock: true },
    });
    return items.reduce((sum, i) => sum + Number(i.price) * i.stock, 0);
  },

  /**
   * Profit = Revenue - Expenses - Payroll - Purchases
   */
  calculateProfit(
    revenue: number,
    expenses: number,
    payroll: number,
    purchases: number
  ): number {
    return revenue - expenses - payroll - purchases;
  },

  /**
   * Profit Margin = (Profit / Revenue) * 100
   */
  calculateProfitMargin(profit: number, revenue: number): number {
    if (revenue === 0) return 0;
    return Math.round((profit / revenue) * 1000) / 10;
  },

  /**
   * Cash Flow = Revenue - Expenses
   */
  calculateCashFlow(revenue: number, expenses: number): number {
    return revenue - expenses;
  },

  /**
   * Working Capital Ratio = Current Assets / Current Liabilities
   * Simplified: (Revenue + Inventory Value) / (Expenses + Payroll + Purchases)
   */
  calculateWorkingCapitalRatio(
    revenue: number,
    inventoryValue: number,
    expenses: number,
    payroll: number,
    purchases: number
  ): number {
    const liabilities = expenses + payroll + purchases;
    if (liabilities === 0) return revenue > 0 ? 99 : 0;
    return Math.round(((revenue + inventoryValue) / liabilities) * 100) / 100;
  },

  /**
   * Operations metrics — derived from sales/invoices data
   */
  async getOperations(orgId: string): Promise<ERPOperations> {
    const { start, end } = getCurrentMonthRange();

    // Billable hours approximation from completed invoices this month
    const paidInvoices = await prisma.invoice.count({
      where: {
        organizationId: orgId,
        status: "PAID",
        issueDate: { gte: start, lte: end },
      },
    });

    // SLA = % of invoices that are not overdue
    const allInvoices = await prisma.invoice.count({
      where: {
        organizationId: orgId,
        issueDate: { gte: start, lte: end },
      },
    });
    const overdueInvoices = await prisma.invoice.count({
      where: {
        organizationId: orgId,
        status: "OVERDUE",
      },
    });

    const sla = allInvoices > 0
      ? Math.round(((allInvoices - overdueInvoices) / allInvoices) * 100)
      : 100;

    // Project overrun — pending sales as % of total
    const pendingSales = await prisma.sale.count({
      where: { organizationId: orgId, status: "PENDING" },
    });
    const totalSales = await prisma.sale.count({
      where: { organizationId: orgId },
    });
    const overrun = totalSales > 0
      ? Math.round((pendingSales / totalSales) * 100)
      : 0;

    // Resource allocation — items with healthy stock
    const totalItems = await prisma.item.count({
      where: { organizationId: orgId },
    });
    const healthyItems = await prisma.item.findMany({
      where: { organizationId: orgId },
    });
    const wellStockedCount = healthyItems.filter(
      (i) => i.stock > i.lowStockAt
    ).length;
    const allocation = totalItems > 0
      ? Math.round((wellStockedCount / totalItems) * 100)
      : 0;

    return {
      billableHours: paidInvoices * 40, // ~40 hours per project
      slaAdherence: sla,
      projectOverrun: overrun,
      resourceAllocation: allocation,
    };
  },

  /**
   * Auto-generate alerts from data analysis
   */
  async getAlerts(orgId: string, metrics: ERPMetrics): Promise<ERPAlert[]> {
    const alerts: ERPAlert[] = [];

    // 1. Low stock alerts
    const lowStockItems = await prisma.item.findMany({
      where: { organizationId: orgId },
    });
    const lowItems = lowStockItems.filter((i) => i.stock <= i.lowStockAt);
    if (lowItems.length > 0) {
      alerts.push({
        id: "low-stock",
        type: "warning",
        title: "Low Stock Alert",
        message: `${lowItems.length} item${lowItems.length > 1 ? "s" : ""} below reorder level: ${lowItems.slice(0, 3).map((i) => i.name).join(", ")}`,
        icon: "Package",
      });
    }

    // 2. Low profitability
    if (metrics.profitMargin < 20 && metrics.revenueMTD > 0) {
      alerts.push({
        id: "low-profit",
        type: "danger",
        title: "Low Profitability",
        message: `Profit margin is ${metrics.profitMargin}% — below the 20% healthy threshold. Review expense categories.`,
        icon: "TrendingDown",
      });
    }

    // 3. Expense spike — if expenses > 60% of revenue
    if (metrics.revenueMTD > 0 && metrics.totalExpenses > metrics.revenueMTD * 0.6) {
      alerts.push({
        id: "expense-spike",
        type: "danger",
        title: "Expense Spike",
        message: `Expenses are ${Math.round((metrics.totalExpenses / metrics.revenueMTD) * 100)}% of revenue. Consider cost reduction.`,
        icon: "AlertTriangle",
      });
    }

    // 4. Resource overloaded — if allocation < 50%
    if (lowItems.length > lowStockItems.length * 0.5 && lowStockItems.length > 0) {
      alerts.push({
        id: "over-allocation",
        type: "warning",
        title: "Over Allocation",
        message: "More than half your inventory is below reorder levels. Resources are over-committed.",
        icon: "AlertCircle",
      });
    }

    // 5. Overdue invoices
    const overdueCount = await prisma.invoice.count({
      where: { organizationId: orgId, status: "OVERDUE" },
    });
    if (overdueCount > 0) {
      alerts.push({
        id: "overdue-invoices",
        type: "warning",
        title: "Overdue Invoices",
        message: `${overdueCount} invoice${overdueCount > 1 ? "s" : ""} past due date. Follow up to maintain cash flow.`,
        icon: "Clock",
      });
    }

    return alerts;
  },

  /**
   * AI-like rule-based suggestions
   */
  async getAISuggestions(
    orgId: string,
    metrics: ERPMetrics
  ): Promise<ERPSuggestion[]> {
    const suggestions: ERPSuggestion[] = [];

    // Find top expense category
    const expenses = await prisma.expense.findMany({
      where: { organizationId: orgId },
      select: { category: true, amount: true },
    });

    const categoryTotals: Record<string, number> = {};
    expenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount);
    });

    const topCategory = Object.entries(categoryTotals).sort(
      ([, a], [, b]) => b - a
    )[0];

    if (topCategory) {
      suggestions.push({
        id: "reduce-expenses",
        title: `Reduce ${topCategory[0].toLowerCase()} expenses`,
        description: `Your highest expense category is "${topCategory[0]}" at ₹${Number(topCategory[1]).toLocaleString("en-IN")}. Consider negotiating vendor contracts or finding alternatives.`,
        impact: "high",
        category: "Cost Reduction",
      });
    }

    // Low margin items
    if (metrics.profitMargin < 25) {
      suggestions.push({
        id: "increase-pricing",
        title: "Increase pricing on low-margin services",
        description: `Current profit margin is ${metrics.profitMargin}%. A 10% price increase on low-margin projects could boost margins to ${Math.round(metrics.profitMargin * 1.15)}%.`,
        impact: "high",
        category: "Revenue Growth",
      });
    }

    // Restock high-demand items
    const lowStockItems = await prisma.item.findMany({
      where: { organizationId: orgId },
    });
    const needRestock = lowStockItems.filter((i) => i.stock <= i.lowStockAt);
    if (needRestock.length > 0) {
      suggestions.push({
        id: "restock-items",
        title: "Restock high-demand items",
        description: `${needRestock.length} item${needRestock.length > 1 ? "s" : ""} need restocking: ${needRestock.slice(0, 3).map((i) => i.name).join(", ")}. Prevent stockouts to maintain revenue.`,
        impact: "medium",
        category: "Inventory",
      });
    }

    // Cash flow optimization
    if (metrics.cashFlow < 0) {
      suggestions.push({
        id: "cash-flow",
        title: "Improve cash flow urgently",
        description: "Negative cash flow detected. Collect pending invoices, defer non-essential purchases, and negotiate extended payment terms with vendors.",
        impact: "high",
        category: "Cash Management",
      });
    } else if (metrics.cashFlow > 0) {
      suggestions.push({
        id: "invest-surplus",
        title: "Invest surplus cash",
        description: `You have positive cash flow of ₹${metrics.cashFlow.toLocaleString("en-IN")}. Consider short-term deposits or inventory investments for better returns.`,
        impact: "low",
        category: "Cash Management",
      });
    }

    // Payroll optimization
    if (metrics.totalPayroll > metrics.revenueMTD * 0.4 && metrics.revenueMTD > 0) {
      suggestions.push({
        id: "payroll-optimization",
        title: "Optimize payroll costs",
        description: `Payroll is ${Math.round((metrics.totalPayroll / metrics.revenueMTD) * 100)}% of revenue. Industry benchmark is 30-35%. Consider automation or contractor models.`,
        impact: "medium",
        category: "Cost Reduction",
      });
    }

    return suggestions;
  },

  /**
   * Active projects — derived from recent sales/invoices
   */
  async getActiveProjects(orgId: string): Promise<ERPProject[]> {
    const sales = await prisma.sale.findMany({
      where: { organizationId: orgId },
      include: { customer: { select: { name: true, company: true } } },
      orderBy: { saleDate: "desc" },
      take: 8,
    });

    return sales.map((s) => ({
      id: s.id,
      name: `${s.saleNumber} — ${s.notes || "Project"}`,
      client: s.customer?.company || s.customer?.name || "Direct Sale",
      status: s.status,
      amount: Number(s.totalAmount),
      progress: s.status === "COMPLETED" ? 100 : s.status === "PENDING" ? 45 : 0,
      dueDate: s.saleDate.toISOString(),
    }));
  },

  /**
   * Master function — get all metrics in one call
   */
  async getDashboard(orgId: string): Promise<ERPDashboardData> {
    // Check if org has any ERP data
    const [salesCount, expenseCount, payrollCount] = await Promise.all([
      prisma.sale.count({ where: { organizationId: orgId } }),
      prisma.expense.count({ where: { organizationId: orgId } }),
      prisma.payroll.count({ where: { organizationId: orgId } }),
    ]);
    const hasData = salesCount > 0 || expenseCount > 0 || payrollCount > 0;

    // Fetch all raw numbers in parallel
    const [
      revenueMTD,
      revenueLastMonth,
      totalExpenses,
      totalPayroll,
      totalPurchases,
      inventoryValue,
      operations,
      projects,
    ] = await Promise.all([
      this.getRevenueMTD(orgId),
      this.getRevenueLastMonth(orgId),
      this.getExpensesMTD(orgId),
      this.getPayrollMTD(orgId),
      this.getPurchasesMTD(orgId),
      this.getInventoryValue(orgId),
      this.getOperations(orgId),
      this.getActiveProjects(orgId),
    ]);

    // Compute derived metrics
    const profit = this.calculateProfit(revenueMTD, totalExpenses, totalPayroll, totalPurchases);
    const profitMargin = this.calculateProfitMargin(profit, revenueMTD);
    const cashFlow = this.calculateCashFlow(revenueMTD, totalExpenses);
    const workingCapitalRatio = this.calculateWorkingCapitalRatio(
      revenueMTD, inventoryValue, totalExpenses, totalPayroll, totalPurchases
    );
    const revenueGrowth = revenueLastMonth > 0
      ? Math.round(((revenueMTD - revenueLastMonth) / revenueLastMonth) * 1000) / 10
      : 0;

    // Total sales count
    const totalSales = await prisma.sale.aggregate({
      where: { organizationId: orgId, status: "COMPLETED" },
      _sum: { totalAmount: true },
    });

    const metrics: ERPMetrics = {
      revenueMTD,
      revenueLastMonth,
      revenueGrowth,
      profit,
      profitMargin,
      cashFlow,
      workingCapitalRatio,
      totalSales: Number(totalSales._sum.totalAmount || 0),
      totalPurchases,
      totalExpenses,
      totalPayroll,
      inventoryValue,
    };

    // Generate alerts and suggestions using computed metrics
    const [alerts, suggestions] = await Promise.all([
      this.getAlerts(orgId, metrics),
      this.getAISuggestions(orgId, metrics),
    ]);

    return {
      metrics,
      operations,
      alerts,
      suggestions,
      projects,
      hasData,
    };
  },
};
