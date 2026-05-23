<<<<<<< HEAD



import {
  PrismaClient,
  Plan,
  Role,
  InvoiceStatus,
  PaymentMethod,
  TransactionType,
  LoanStatus,
  PaymentStatus,
  ComplianceCategory,
  TaskStatus,
  AccountType,
  CustomerType,
  ExpenseCategory,
  SaleStatus,
  PurchaseStatus,
  EmploymentType,
  LeadStatus,
  NotificationType,
  AuditAction,
  LenderType,
} from "@prisma/client";

import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

const randomDecimal = (min: number, max: number) =>
  Number((Math.random() * (max - min) + min).toFixed(2));

async function main() {
  // =======================================================
  // ASK TENANT ID FROM TERMINAL
  // =======================================================

  const seedOrgId = process.argv[2];

  if (!seedOrgId) {
    console.error(`
❌ Organization/Tenant ID missing

Usage:

npx tsx prisma/seed.ts YOUR_ORG_ID
`);
    process.exit(1);
  }

  console.log(`🌱 Seeding organization: ${seedOrgId}`);

  // =======================================================
  // VERIFY ORGANIZATION EXISTS
  // =======================================================

  const organization = await prisma.organization.findFirst({
    where: {
      OR: [
        {
          id: seedOrgId,
        },
        {
          users: {
            some: {
              clerkId: seedOrgId,
            },
          },
        },
      ],
    },
    include: {
      users: true,
    },
  });

  if (!organization) {
    console.error("❌ Organization not found");
    process.exit(1);
  }

  const actualOrganizationId = organization.id;

  // =======================================================
  // FIND EXISTING USER
  // =======================================================

  let users = await prisma.user.findMany({
    where: {
      organizationId: actualOrganizationId,
    },
  });

  // create users if none exist

  if (users.length === 0) {
    for (let i = 0; i < 10; i++) {
      const created = await prisma.user.create({
        data: {
          clerkId: `seed_user_${i}`,
          email: faker.internet.email(),
          name: faker.person.fullName(),
          phone: faker.phone.number(),
          role: faker.helpers.arrayElement([
            Role.ADMIN,
            Role.MANAGER,
            Role.ACCOUNTANT,
            Role.STAFF,
          ]),
          designation: faker.person.jobTitle(),
          department: faker.commerce.department(),
          organizationId: actualOrganizationId,
        },
      });

      users.push(created);
    }
  }

  const seedUser = users[0];

  // =======================================================
  // CLEAN OLD SEEDED DATA
  // =======================================================

  await prisma.saleItem.deleteMany({});
  await prisma.purchaseItem.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.loanPayment.deleteMany({});

  await prisma.payment.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.transaction.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.sale.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.purchase.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.invoice.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.expense.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.payroll.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.employee.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.loan.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.analyticsRecord.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.notification.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.complianceTask.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.lead.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.item.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.vendor.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.customer.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.account.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  await prisma.bankAccount.deleteMany({
    where: { organizationId: actualOrganizationId },
  });

  // =======================================================
  // SETTINGS
  // =======================================================

  await prisma.settings.upsert({
    where: {
      organizationId: actualOrganizationId,
    },
    update: {},
    create: {
      organizationId: actualOrganizationId,
    },
  });

  // =======================================================
  // BUSINESS PROFILE
  // =======================================================

  await prisma.businessProfile.upsert({
    where: {
      organizationId: actualOrganizationId,
    },
    update: {},
    create: {
      organizationId: actualOrganizationId,
      businessName: organization.name,
      businessType: "Private Limited",
      industry: "Software",
      country: "India",
      state: "Karnataka",
      city: "Bangalore",
      address: faker.location.streetAddress(),
      onboardingComplete: true,
      onboardingStep: 10,
      currency: "INR",
      initialCapital: 1000000,
      openingBankBalance: 500000,
      openingCashBalance: 100000,
    },
  });

  // =======================================================
  // CHART OF ACCOUNTS
  // =======================================================

  const accountTemplates = [
    {
      code: "1001",
      name: "Cash",
      type: AccountType.ASSET,
    },
    {
      code: "1002",
      name: "Bank",
      type: AccountType.ASSET,
    },
    {
      code: "2001",
      name: "Accounts Payable",
      type: AccountType.LIABILITY,
    },
    {
      code: "3001",
      name: "Capital",
      type: AccountType.EQUITY,
    },
    {
      code: "4001",
      name: "Sales Revenue",
      type: AccountType.REVENUE,
    },
    {
      code: "5001",
      name: "Office Expense",
      type: AccountType.EXPENSE,
    },
  ];

  const accounts = [];

  for (const acc of accountTemplates) {
    const account = await prisma.account.create({
      data: {
        ...acc,
        organizationId: actualOrganizationId,
        balance: randomDecimal(10000, 500000),
      },
    });

    accounts.push(account);
  }

  // =======================================================
  // BANK ACCOUNT
  // =======================================================

  const bankAccount = await prisma.bankAccount.create({
    data: {
      organizationId: actualOrganizationId,
      accountName: "Main Business Account",
      bankName: "HDFC Bank",
      accountNumber: faker.finance.accountNumber(),
      ifscCode: "HDFC0001234",
      openingBalance: 500000,
      currentBalance: 750000,
      isPrimary: true,
    },
  });

  // =======================================================
  // CUSTOMERS
  // =======================================================

  const customers = [];

  for (let i = 0; i < 40; i++) {
    const customer = await prisma.customer.create({
      data: {
        customerCode: `CUST-${1000 + i}`,
        name: faker.person.fullName(),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        company: faker.company.name(),
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        country: "India",
        gstin: faker.string.alphanumeric(15),
        customerType: faker.helpers.arrayElement([
          CustomerType.BUSINESS,
          CustomerType.RETAIL,
          CustomerType.WHOLESALE,
        ]),
        creditLimit: randomDecimal(5000, 50000),
        outstandingAmount: randomDecimal(1000, 10000),
        totalPurchases: randomDecimal(10000, 500000),
        customerScore: faker.number.int({ min: 50, max: 100 }),
        tags: ["vip", "priority"],
        organizationId: actualOrganizationId,
      },
    });

    customers.push(customer);
  }

  // =======================================================
  // VENDORS
  // =======================================================

  const vendors = [];

  for (let i = 0; i < 20; i++) {
    const vendor = await prisma.vendor.create({
      data: {
        vendorCode: `VEND-${1000 + i}`,
        name: faker.company.name(),
        contactPerson: faker.person.fullName(),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        country: "India",
        gstin: faker.string.alphanumeric(15),
        outstandingBalance: randomDecimal(5000, 50000),
        totalPurchases: randomDecimal(10000, 100000),
        organizationId: actualOrganizationId,
      },
    });

    vendors.push(vendor);
  }

  // =======================================================
  // ITEMS
  // =======================================================

  const items = [];

  for (let i = 0; i < 50; i++) {
    const item = await prisma.item.create({
      data: {
        sku: `SKU-${1000 + i}`,
        barcode: faker.string.numeric(12),
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        category: faker.commerce.department(),
        brand: faker.company.name(),
        unit: "pcs",
        stock: faker.number.int({ min: 10, max: 500 }),
        reorderLevel: 20,
        lowStockAt: 15,
        warehouse: "Main Warehouse",
        costPrice: randomDecimal(100, 1000),
        sellingPrice: randomDecimal(1000, 5000),
        taxRate: 18,
        organizationId: actualOrganizationId,
        vendorId: faker.helpers.arrayElement(vendors).id,
      },
    });

    items.push(item);
  }

  // =======================================================
  // INVOICES + PAYMENTS
  // =======================================================

  for (let i = 0; i < 60; i++) {
    const customer = faker.helpers.arrayElement(customers);

    const selectedItems = faker.helpers.arrayElements(items, 3);

    let subtotal = 0;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${1000 + i}`,
        customerId: customer.id,
        organizationId: actualOrganizationId,
        status: faker.helpers.arrayElement([
          InvoiceStatus.PAID,
          InvoiceStatus.PARTIAL,
          InvoiceStatus.SENT,
        ]),
        dueDate: faker.date.future(),
        subtotal: 0,
        total: 0,
        balanceDue: 0,
        createdById: seedUser.id,
      },
    });

    for (const item of selectedItems) {
      const qty = faker.number.int({ min: 1, max: 10 });

      const amount = Number(item.sellingPrice) * qty;

      subtotal += amount;

      await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          description: item.name,
          sku: item.sku,
          quantity: qty,
          unitPrice: item.sellingPrice,
          costPrice: item.costPrice,
          taxPercent: item.taxRate,
          amount,
          profit: amount - Number(item.costPrice) * qty,
        },
      });
    }

    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    const paid = faker.number.int({
      min: 0,
      max: Math.floor(total),
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        subtotal,
        taxAmount: tax,
        total,
        paidAmount: paid,
        balanceDue: total - paid,
      },
    });

    if (paid > 0) {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          organizationId: actualOrganizationId,
          amount: paid,
          method: faker.helpers.arrayElement([
            PaymentMethod.UPI,
            PaymentMethod.BANK_TRANSFER,
            PaymentMethod.CASH,
          ]),
          paidAt: faker.date.recent(),
          bankAccountId: bankAccount.id,
          createdById: seedUser.id,
        },
      });
    }
  }

  // =======================================================
  // EXPENSES
  // =======================================================

  for (let i = 0; i < 40; i++) {
    await prisma.expense.create({
      data: {
        category: faker.helpers.arrayElement([
          ExpenseCategory.RENT,
          ExpenseCategory.MARKETING,
          ExpenseCategory.SOFTWARE,
          ExpenseCategory.OPERATIONS,
        ]),
        description: faker.commerce.productDescription(),
        amount: randomDecimal(1000, 50000),
        organizationId: actualOrganizationId,
        createdById: seedUser.id,
        paymentAccountId: faker.helpers.arrayElement(accounts).id,
      },
    });
  }

  // =======================================================
  // LEADS
  // =======================================================

  for (let i = 0; i < 30; i++) {
    await prisma.lead.create({
      data: {
        organizationId: actualOrganizationId,
        name: faker.person.fullName(),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        company: faker.company.name(),
        source: "Website",
        valueEstimate: randomDecimal(10000, 500000),
        status: faker.helpers.arrayElement([
          LeadStatus.NEW,
          LeadStatus.CONTACTED,
          LeadStatus.WON,
        ]),
        assignedToId: seedUser.id,
      },
    });
  }

  // =======================================================
  // ANALYTICS
  // =======================================================

  const metrics = [
    "revenue",
    "expenses",
    "profit",
    "customers",
    "sales",
  ];

  for (const metric of metrics) {
    for (let month = 1; month <= 12; month++) {
      await prisma.analyticsRecord.create({
        data: {
          organizationId: actualOrganizationId,
          period: `2026-${month.toString().padStart(2, "0")}`,
          metric,
          value: randomDecimal(10000, 1000000),
        },
      });
    }
  }

  console.log("✅ Org-scoped database seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
=======

>>>>>>> e4f680f2d810915ceea214f7ce50a697ad2db957
