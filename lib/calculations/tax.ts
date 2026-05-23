export function calculateGST(
  amount: number,
  taxRate: number
) {
  const taxAmount = (amount * taxRate) / 100;

  return {
    taxAmount,
    total: amount + taxAmount,
  };
}