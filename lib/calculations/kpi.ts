// ============================================================
// lib/calculations/kpi.ts
// KPI calculators for the FinRP dashboard.
// ============================================================

// ---------------------------------------------------------------------------
// Core metrics
// ---------------------------------------------------------------------------

export function calculateProfit(revenue: number, expenses: number): number {
  return revenue - expenses;
}

export function calculateGrossMargin(revenue: number, cogs: number): number {
  if (!revenue) return 0;
  return ((revenue - cogs) / revenue) * 100;
}

export function calculateNetMargin(revenue: number, netProfit: number): number {
  if (!revenue) return 0;
  return (netProfit / revenue) * 100;
}

export function calculateGrowth(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// ---------------------------------------------------------------------------
// Liquidity & working capital
// ---------------------------------------------------------------------------

export function calculateCurrentRatio(
  currentAssets: number,
  currentLiabilities: number
): number {
  if (!currentLiabilities) return 0;
  return currentAssets / currentLiabilities;
}

export function calculateWorkingCapital(
  currentAssets: number,
  currentLiabilities: number
): number {
  return currentAssets - currentLiabilities;
}

// ---------------------------------------------------------------------------
// Receivables & payables
// ---------------------------------------------------------------------------

/** Days Sales Outstanding — average days to collect payment */
export function calculateDSO(
  accountsReceivable: number,
  totalCreditSales: number,
  periodDays = 30
): number {
  if (!totalCreditSales) return 0;
  return (accountsReceivable / totalCreditSales) * periodDays;
}

/** Days Payable Outstanding — average days to pay suppliers */
export function calculateDPO(
  accountsPayable: number,
  cogs: number,
  periodDays = 30
): number {
  if (!cogs) return 0;
  return (accountsPayable / cogs) * periodDays;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export function calculateInventoryTurnover(
  cogs: number,
  averageInventoryValue: number
): number {
  if (!averageInventoryValue) return 0;
  return cogs / averageInventoryValue;
}

export function calculateStockCoverDays(
  currentStock: number,
  averageDailySales: number
): number {
  if (!averageDailySales) return 0;
  return currentStock / averageDailySales;
}

// ---------------------------------------------------------------------------
// Loan / debt
// ---------------------------------------------------------------------------

/** Debt Service Coverage Ratio — ability to service debt from operating income */
export function calculateDSCR(
  netOperatingIncome: number,
  totalDebtService: number
): number {
  if (!totalDebtService) return 0;
  return netOperatingIncome / totalDebtService;
}

export function calculateEMI(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number
): number {
  if (!annualInterestRate) return principal / tenureMonths;
  const monthlyRate = annualInterestRate / 12 / 100;
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1)
  );
}

export function calculateLoanAmortization(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number
): Array<{
  month: number;
  emi: number;
  principal: number;
  interest: number;
  balance: number;
}> {
  const emi = calculateEMI(principal, annualInterestRate, tenureMonths);
  const monthlyRate = annualInterestRate / 12 / 100;
  const schedule = [];
  let balance = principal;

  for (let i = 1; i <= tenureMonths; i++) {
    const interest = balance * monthlyRate;
    const principalPaid = emi - interest;
    balance = Math.max(0, balance - principalPaid);

    schedule.push({
      month: i,
      emi: round2(emi),
      principal: round2(principalPaid),
      interest: round2(interest),
      balance: round2(balance),
    });
  }

  return schedule;
}

// ---------------------------------------------------------------------------
// CRM / Sales
// ---------------------------------------------------------------------------

export function calculateCustomerLifetimeValue(
  averageOrderValue: number,
  purchaseFrequencyPerYear: number,
  avgCustomerLifespanYears: number
): number {
  return averageOrderValue * purchaseFrequencyPerYear * avgCustomerLifespanYears;
}

export function calculateChurnRate(
  lostCustomers: number,
  startingCustomers: number
): number {
  if (!startingCustomers) return 0;
  return (lostCustomers / startingCustomers) * 100;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Return trend arrow and sign for display */
export function trendLabel(value: number): { label: string; positive: boolean } {
  const positive = value >= 0;
  const label = `${positive ? "+" : ""}${value.toFixed(1)}%`;
  return { label, positive };
}
