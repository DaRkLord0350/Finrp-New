// ============================================================
// lib/calculations/tax.ts
// GST, TDS, and general tax calculations for India.
// ============================================================

export interface GSTBreakdown {
  baseAmount: number;
  cgst: number;       // Central GST (intra-state)
  sgst: number;       // State GST  (intra-state)
  igst: number;       // Integrated GST (inter-state)
  cess: number;
  totalTax: number;
  totalAmount: number;
}

/**
 * Calculate GST breakdown.
 * @param amount     - Base (pre-tax) amount
 * @param taxRate    - Total GST rate (e.g. 18 for 18%)
 * @param isInterState - If true, IGST applies; otherwise CGST+SGST split
 * @param cessRate   - Optional cess percentage (default 0)
 */
export function calculateGST(
  amount: number,
  taxRate: number,
  isInterState = false,
  cessRate = 0
): GSTBreakdown {
  const halfRate = taxRate / 2;
  const cgst = isInterState ? 0 : (amount * halfRate) / 100;
  const sgst = isInterState ? 0 : (amount * halfRate) / 100;
  const igst = isInterState ? (amount * taxRate) / 100 : 0;
  const cess = (amount * cessRate) / 100;
  const totalTax = cgst + sgst + igst + cess;

  return {
    baseAmount: amount,
    cgst,
    sgst,
    igst,
    cess,
    totalTax,
    totalAmount: amount + totalTax,
  };
}

/**
 * Reverse-calculate: extract base amount from a GST-inclusive total.
 */
export function extractBaseFromGSTInclusive(
  inclusiveAmount: number,
  taxRate: number
): { baseAmount: number; taxAmount: number } {
  const baseAmount = inclusiveAmount / (1 + taxRate / 100);
  return {
    baseAmount: round2(baseAmount),
    taxAmount: round2(inclusiveAmount - baseAmount),
  };
}

/**
 * Calculate TDS (Tax Deducted at Source).
 */
export function calculateTDS(
  amount: number,
  tdsRate: number
): { netPayable: number; tdsAmount: number } {
  const tdsAmount = round2((amount * tdsRate) / 100);
  return { tdsAmount, netPayable: round2(amount - tdsAmount) };
}

/**
 * Calculate applicable GST slab for common Indian goods/services.
 * Returns the standard GST rate for the category.
 */
export function getGSTSlab(category: string): number {
  const slabs: Record<string, number> = {
    essential_goods: 0,
    food: 5,
    medicines: 5,
    textiles: 5,
    processed_food: 12,
    electronics: 18,
    financial_services: 18,
    software: 18,
    professional_services: 18,
    luxury: 28,
    automobiles: 28,
  };
  return slabs[category.toLowerCase()] ?? 18;
}

// ---------------------------------------------------------------------------
// Invoice-level tax calculation
// ---------------------------------------------------------------------------
export interface InvoiceItem {
  quantity: number;
  unitPrice: number;
  discount?: number;   // Flat discount per line
  taxPercent?: number;
}

export interface InvoiceTotals {
  subtotal: number;     // Sum of line amounts before tax
  totalDiscount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
}

export function calculateInvoiceTotals(
  items: InvoiceItem[],
  shipping = 0,
  globalDiscount = 0  // Flat discount on the whole invoice
): InvoiceTotals {
  let subtotal = 0;
  let totalDiscount = 0;
  let taxAmount = 0;

  for (const item of items) {
    const lineAmount = item.quantity * item.unitPrice;
    const lineDiscount = item.discount ?? 0;
    const taxable = lineAmount - lineDiscount;
    const lineTax = (taxable * (item.taxPercent ?? 0)) / 100;

    subtotal += lineAmount;
    totalDiscount += lineDiscount;
    taxAmount += lineTax;
  }

  totalDiscount += globalDiscount;
  const taxableAmount = subtotal - totalDiscount;
  const total = taxableAmount + taxAmount + shipping;

  return {
    subtotal: round2(subtotal),
    totalDiscount: round2(totalDiscount),
    taxableAmount: round2(taxableAmount),
    taxAmount: round2(taxAmount),
    total: round2(total),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
