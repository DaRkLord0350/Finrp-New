import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number | string,
  currency = "USD"
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatRelativeDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return formatDate(d);
}

export function getInvoiceStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    SENT: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    PAID: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    OVERDUE: "bg-red-500/20 text-red-400 border-red-500/30",
    CANCELLED: "bg-zinc-600/20 text-zinc-500 border-zinc-600/30",
  };
  return colors[status] || colors.DRAFT;
}

export function getTaskStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    IN_PROGRESS: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    COMPLETED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    OVERDUE: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return colors[status] || colors.PENDING;
}

export function generateInvoiceNumber(count: number): string {
  return `INV-${String(count + 1).padStart(5, "0")}`;
}

export function calculateInvoiceTotals(
  items: { quantity: number; unitPrice: number }[],
  taxRate: number
) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}
