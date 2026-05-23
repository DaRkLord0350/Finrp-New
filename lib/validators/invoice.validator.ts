import { z } from "zod";

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  dueDate: z.string(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
    })
  ),
});