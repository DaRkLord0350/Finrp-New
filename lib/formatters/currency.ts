// ============================================================
// lib/formatters/currency.ts
// ============================================================

/**
 * Format a number as currency.
 * @example formatCurrency(150000)       → "₹1,50,000.00"
 * @example formatCurrency(1500, "USD")  → "$1,500.00"
 */
export function formatCurrency(amount: number, currency = "INR"): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number as compact currency (₹1.5L, ₹2.3Cr, $1.2M).
 */
export function formatCompactCurrency(amount: number, currency = "INR"): string {
  if (currency === "INR") {
    if (Math.abs(amount) >= 1_00_00_000) {
      return `₹${(amount / 1_00_00_000).toFixed(2)}Cr`;
    }
    if (Math.abs(amount) >= 1_00_000) {
      return `₹${(amount / 1_00_000).toFixed(2)}L`;
    }
    if (Math.abs(amount) >= 1_000) {
      return `₹${(amount / 1_000).toFixed(1)}K`;
    }
    return `₹${amount.toFixed(0)}`;
  }

  // Generic compact for other currencies
  const symbol = getCurrencySymbol(currency);
  if (Math.abs(amount) >= 1_000_000_000) return `${symbol}${(amount / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(amount) >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(2)}M`;
  if (Math.abs(amount) >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}K`;
  return `${symbol}${amount.toFixed(0)}`;
}

/**
 * Parse a formatted currency string back to a number.
 */
export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]/g, "")) || 0;
}

/**
 * Get the currency symbol for a currency code.
 */
export function getCurrencySymbol(currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? currency;
}
