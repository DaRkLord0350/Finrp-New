// ============================================================
// FinRP — Demo Data Seeder
// Generates realistic org-scoped sample data using faker.
// Called only when user selects "Use Demo Data" in onboarding.
// ALL records are scoped to organizationId.
// ============================================================

import { prisma } from "@/lib/prisma";
import { faker } from "@faker-js/faker";
import type { DemoSeedResult } from "@/types/onboarding";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export async function seedDemoData(organizationId: string): Promise<DemoSeedResult> {
  const counts = { customers: 0, items: 0, invoices: 0, expenses: 0, employees: 0 };

  // Ensure org exists and has not already been seeded (idempotency check)
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, _count: { select: { customers: true } } },
  });
  if (!org) return { success: false, seeded: counts, error: "Organization not found" };
  if (org._count.customers > 0) {
    return { success: true, seeded: counts }; // already seeded, skip
  }

  // Get the OWNER user id for createdById references
  const owner = await prisma.user.findFirst({
    where: { organizationId, role: "OWNER" },
    select: { id: true },
  });
  const ownerId = owner?.id ?? null;

  await prisma.$transaction(async (tx) => {
    // ── Customers ──────────────────────────────────────────────────────────
    const customers = await Promise.all(
      Array.from({ length: 8 }).map(() =>
        tx.customer.create({
          data: {
            organizationId,
            name: faker.company.name(),
            email: faker.internet.email(),
            phone: faker.phone.number(),
            company: faker.company.name(),
            address: faker.location.streetAddress(),
            city: faker.location.city(),
            state: faker.location.state(),
            country: "India",
            customerType: faker.helpers.arrayElement(["INDIVIDUAL", "BUSINESS"] as const),
            creditLimit: faker.number.float({ min: 50000, max: 500000, fractionDigits: 2 }),
            totalPurchases: faker.number.float({ min: 10000, max: 300000, fractionDigits: 2 }),
            isActive: true,
          },
        })
      )
    );
    counts.customers = customers.length;

    // ── Items / Products ───────────────────────────────────────────────────
    const items = await Promise.all(
      Array.from({ length: 10 }).map(() => {
        const costPrice = faker.number.float({ min: 500, max: 5000, fractionDigits: 2 });
        return tx.item.create({
          data: {
            organizationId,
            name: faker.commerce.productName(),
            description: faker.commerce.productDescription(),
            category: faker.commerce.department(),
            sku: faker.string.alphanumeric(8).toUpperCase(),
            costPrice,
            sellingPrice: Number((costPrice * faker.number.float({ min: 1.2, max: 2.0, fractionDigits: 2 })).toFixed(2)),
            taxRate: faker.helpers.arrayElement([0, 5, 12, 18]),
            stock: faker.number.int({ min: 10, max: 500 }),
            reorderLevel: 10,
            lowStockAt: 10,
            unit: faker.helpers.arrayElement(["pcs", "kg", "box", "unit", "litre"]),
            isActive: true,
          },
        });
      })
    );
    counts.items = items.length;

    // ── Invoices ────────────────────────────────────────────────────────────
    const statuses = ["DRAFT", "SENT", "PAID", "PARTIAL", "OVERDUE"] as const;
    const invoices = await Promise.all(
      Array.from({ length: 12 }).map(async (_, idx) => {
        const customer = faker.helpers.arrayElement(customers);
        const subtotal = faker.number.float({ min: 5000, max: 150000, fractionDigits: 2 });
        const taxRate = faker.helpers.arrayElement([0, 5, 12, 18]);
        const taxAmount = Number((subtotal * taxRate / 100).toFixed(2));
        const total = Number((subtotal + taxAmount).toFixed(2));
        const status = faker.helpers.arrayElement(statuses);
        const paidAmount = status === "PAID" ? total : status === "PARTIAL" ? Number((total * 0.5).toFixed(2)) : 0;

        const issueDate = faker.date.recent({ days: 90 });
        const dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + 30);

        return tx.invoice.create({
          data: {
            organizationId,
            customerId: customer.id,
            invoiceNumber: `INV-DEMO-${String(idx + 1).padStart(4, "0")}`,
            status,
            issueDate,
            dueDate,
            subtotal,
            taxRate,
            taxAmount,
            total,
            paidAmount,
            balanceDue: Number((total - paidAmount).toFixed(2)),
            currency: "INR",
            createdById: ownerId,
            items: {
              create: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }).map(() => {
                const item = faker.helpers.arrayElement(items);
                const qty = faker.number.int({ min: 1, max: 10 });
                const price = Number(item.sellingPrice);
                return {
                  description: item.name,
                  sku: item.sku ?? undefined,
                  quantity: qty,
                  unitPrice: price,
                  amount: Number((qty * price).toFixed(2)),
                  taxPercent: Number(item.taxRate),
                  taxAmount: Number(((qty * price * Number(item.taxRate)) / 100).toFixed(2)),
                };
              }),
            },
          },
        });
      })
    );
    counts.invoices = invoices.length;

    // ── Expenses ────────────────────────────────────────────────────────────
    const expenseCategories = [
      "RENT", "UTILITIES", "MARKETING", "SOFTWARE", "TRAVEL", "OPERATIONS",
    ] as const;
    const expenses = await Promise.all(
      Array.from({ length: 8 }).map(() =>
        tx.expense.create({
          data: {
            organizationId,
            category: faker.helpers.arrayElement(expenseCategories),
            description: faker.commerce.productDescription(),
            amount: faker.number.float({ min: 1000, max: 50000, fractionDigits: 2 }),
            vendorName: faker.company.name(),
            expenseDate: faker.date.recent({ days: 60 }),
            createdById: ownerId,
          },
        })
      )
    );
    counts.expenses = expenses.length;

    // ── Employees ──────────────────────────────────────────────────────────
    const employees = await Promise.all(
      Array.from({ length: 5 }).map((_, idx) => {
        const baseSalary = faker.number.float({ min: 30000, max: 200000, fractionDigits: 2 });
        return tx.employee.create({
          data: {
            organizationId,
            employeeCode: `EMP-${String(idx + 1).padStart(3, "0")}`,
            name: faker.person.fullName(),
            email: faker.internet.email(),
            phone: faker.phone.number(),
            designation: faker.person.jobTitle(),
            department: faker.person.jobArea(),
            employmentType: "FULL_TIME",
            baseSalary,
            joiningDate: faker.date.past({ years: 2 }),
            isActive: true,
          },
        });
      })
    );
    counts.employees = employees.length;

    // ── Seed a notification ────────────────────────────────────────────────
    if (ownerId) {
      await tx.notification.create({
        data: {
          organizationId,
          userId: ownerId,
          type: "SYSTEM",
          title: "Welcome to FinRP!",
          message:
            "Your demo data has been seeded. Explore the dashboard to see your sample data.",
          isRead: false,
        },
      });
    }

    // ── Audit log ──────────────────────────────────────────────────────────
    if (ownerId) {
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: ownerId,
          action: "CREATE",
          entity: "demo_seed",
          description: `Seeded demo data: ${counts.customers} customers, ${counts.items} items, ${counts.invoices} invoices`,
        },
      });
    }
  });

  return { success: true, seeded: counts };
}
