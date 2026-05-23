import { InvoiceStatus } from "@prisma/client";

export function getInvoiceStatusColor(
  status: InvoiceStatus
) {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-700 border-green-200";

    case "PARTIAL":
      return "bg-orange-100 text-orange-700 border-orange-200";

    case "OVERDUE":
      return "bg-red-100 text-red-700 border-red-200";

    case "SENT":
      return "bg-blue-100 text-blue-700 border-blue-200";

    case "VIEWED":
      return "bg-cyan-100 text-cyan-700 border-cyan-200";

    case "DRAFT":
      return "bg-gray-100 text-gray-700 border-gray-200";

    case "CANCELLED":
      return "bg-zinc-100 text-zinc-700 border-zinc-200";

    default:
      return "bg-muted text-muted-foreground border-border";
  }
}