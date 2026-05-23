export function generateInvoiceNumber(
  prefix: string,
  count: number
) {
  return `${prefix}-${String(count).padStart(5, "0")}`;
}