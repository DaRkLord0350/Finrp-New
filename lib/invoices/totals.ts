// ============================================================
// lib/invoices/totals.ts
//
// Single source of truth for invoice money math. Pure & isomorphic —
// imported by both the API route (authoritative persistence) and the
// React form hook (real-time preview), so the number a user sees while
// typing is exactly the number that gets stored.
//
// Money is kept as JS numbers rounded to 2 decimals at every step
// (matching the existing lib/calculations/tax.ts convention). The
// double-entry LEDGER re-derives every amount in Prisma.Decimal from the
// stored columns (see lib/accounting/posting.ts), so ledger integrity
// never depends on float math here.
//
// Calculation order (mirrors Zoho Books):
//   subtotal               = Σ (qty × unitPrice)
//   − line discounts       (per-row flat amounts)
//   − invoice discount     (% of post-line-discount base, or a flat amount)
//   = taxable amount
//   + GST/VAT              (Σ per-line tax, or taxable × invoice rate)
//   + shipping
//   ± adjustment
//   − TDS  /  + TCS        (computed on the pre-GST taxable amount)
//   ± round-off            (auto to nearest 1.00, or an explicit override)
//   = grand total
// ============================================================

export type DiscountType = "FIXED" | "PERCENT";
export type TdsTcsType = "TDS" | "TCS";

export interface TotalsLineInput {
  quantity: number;
  unitPrice: number;
  discount?: number; // per-line flat discount amount
  taxPercent?: number;
}

export interface TotalsInput {
  items: TotalsLineInput[];
  /** Fallback invoice-level GST/VAT rate used only when no line carries a taxPercent. */
  invoiceTaxRate?: number;
  discountType?: DiscountType;
  discountValue?: number; // raw entered invoice-level discount (% or amount)
  shipping?: number;
  adjustment?: number; // arbitrary +/- adjustment
  tdsTcsType?: TdsTcsType | null;
  tdsTcsRate?: number;
  /** Explicit round-off override. When undefined, round-off auto-targets the nearest 1.00. */
  roundOff?: number;
  /** Auto-compute round-off to the nearest whole unit (default true). */
  autoRound?: boolean;
}

export interface InvoiceTotals {
  subtotal: number;
  lineDiscountTotal: number;
  invoiceDiscount: number;
  totalDiscount: number;
  taxableAmount: number;
  taxAmount: number;
  effectiveTaxRate: number;
  shipping: number;
  adjustment: number;
  tdsTcsType: TdsTcsType | null;
  tdsTcsRate: number;
  tdsTcsAmount: number;
  preRoundTotal: number;
  roundOff: number;
  grandTotal: number;
}

export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
};

export function computeInvoiceTotals(input: TotalsInput): InvoiceTotals {
  const items = input.items ?? [];
  const invoiceTaxRate = num(input.invoiceTaxRate);
  const discountType: DiscountType = input.discountType === "PERCENT" ? "PERCENT" : "FIXED";
  const discountValue = Math.max(0, num(input.discountValue));
  const shipping = num(input.shipping);
  const adjustment = num(input.adjustment);
  const tdsTcsType: TdsTcsType | null =
    input.tdsTcsType === "TDS" || input.tdsTcsType === "TCS" ? input.tdsTcsType : null;
  const tdsTcsRate = Math.max(0, num(input.tdsTcsRate));

  let subtotal = 0;
  let lineDiscountTotal = 0;
  let perLineTax = 0;
  let anyLineTax = false;

  for (const line of items) {
    const qty = num(line.quantity);
    const price = num(line.unitPrice);
    const lineAmount = round2(qty * price);
    const lineDiscount = Math.max(0, Math.min(num(line.discount), lineAmount));
    const taxPercent = num(line.taxPercent);
    if (taxPercent > 0) anyLineTax = true;
    const lineTax = round2((lineAmount - lineDiscount) * (taxPercent / 100));

    subtotal = round2(subtotal + lineAmount);
    lineDiscountTotal = round2(lineDiscountTotal + lineDiscount);
    perLineTax = round2(perLineTax + lineTax);
  }

  // Invoice-level discount applies to the post-line-discount base.
  const discountBase = round2(subtotal - lineDiscountTotal);
  const invoiceDiscount =
    discountType === "PERCENT"
      ? round2(discountBase * (discountValue / 100))
      : Math.min(discountValue, discountBase);
  const totalDiscount = round2(lineDiscountTotal + invoiceDiscount);
  const taxableAmount = round2(subtotal - totalDiscount);

  // Tax: prefer per-line GST; otherwise apply the invoice-level rate to the taxable base.
  const taxAmount = anyLineTax ? perLineTax : round2(taxableAmount * (invoiceTaxRate / 100));
  const effectiveTaxRate = taxableAmount > 0 ? round2((taxAmount / taxableAmount) * 100) : 0;

  // TDS is withheld (subtracted); TCS is collected (added). Both on the pre-GST taxable value.
  const tdsTcsAmount = tdsTcsType ? round2(taxableAmount * (tdsTcsRate / 100)) : 0;
  const tdsTcsSigned = tdsTcsType === "TDS" ? -tdsTcsAmount : tdsTcsType === "TCS" ? tdsTcsAmount : 0;

  const preRoundTotal = round2(taxableAmount + taxAmount + shipping + adjustment + tdsTcsSigned);

  const autoRound = input.autoRound !== false;
  const roundOff =
    input.roundOff !== undefined && input.roundOff !== null
      ? round2(num(input.roundOff))
      : autoRound
        ? round2(Math.round(preRoundTotal) - preRoundTotal)
        : 0;

  const grandTotal = round2(preRoundTotal + roundOff);

  return {
    subtotal,
    lineDiscountTotal,
    invoiceDiscount,
    totalDiscount,
    taxableAmount,
    taxAmount,
    effectiveTaxRate,
    shipping,
    adjustment,
    tdsTcsType,
    tdsTcsRate: tdsTcsType ? tdsTcsRate : 0,
    tdsTcsAmount,
    preRoundTotal,
    roundOff,
    grandTotal,
  };
}
