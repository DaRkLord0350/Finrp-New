export function calculateProfit(
  revenue: number,
  expense: number
) {
  return revenue - expense;
}

export function calculateMargin(
  revenue: number,
  profit: number
) {
  if (!revenue) return 0;

  return (profit / revenue) * 100;
}

export function calculateGrowth(
  current: number,
  previous: number
) {
  if (!previous) return 0;

  return ((current - previous) / previous) * 100;
}