import {
  PrismaClient,
  Plan,
  Role,
  InvoiceStatus,
  PaymentMethod,
  TransactionType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ─────────────────────────────────────────────────────────────
  // IMPORTANT: Pass your actual Clerk userId (or orgId) via the
  // SEED_ORG_ID environment variable so the seeded data is
  // visible to your logged-in account.
  //
  // How to find your tenantId:
  //   1. Run `npm run dev`, log in, then visit:
  //      http://localhost:3000/api/debug/tenant
  //   2. Copy the `tenantId` value from the JSON response
  //   3. Re-run seed:
  //      $env:SEED_ORG_ID="<your-tenantId>"; npx prisma db seed
  // ─────────────────────────────────────────────────────────────
  const seedOrgId = process.env.SEED_ORG_ID;
  if (!seedOrgId) {
    console.error(
      "\n❌  SEED_ORG_ID is not set!\n" +
      "    Visit http://localhost:3000/api/debug/tenant while logged in\n" +
      "    to get your tenantId, then run:\n\n" +
      '    $env:SEED_ORG_ID="<your-tenantId>"; npx prisma db seed\n'
    );
    process.exit(1);
  }

  console.log(`🌱 Seeding database with organizationId = ${seedOrgId}`);

  // ── Wipe existing data for this tenant so re-seeding is safe ──
  await prisma.analyticsRecord.deleteMany({ where: { organizationId: seedOrgId } });
  await prisma.transaction.deleteMany({ where: { organizationId: seedOrgId } });
  await prisma.complianceTask.deleteMany({ where: { organizationId: seedOrgId } });
  await prisma.payment.deleteMany({ where: { organizationId: seedOrgId } });
  await prisma.invoice.deleteMany({ where: { organizationId: seedOrgId } });
  await prisma.item.deleteMany({ where: { organizationId: seedOrgId } });
  await prisma.customer.deleteMany({ where: { organizationId: seedOrgId } });
  // Don't delete the Organization itself — it may be a Clerk user ID (virtual org)

  // ── Upsert an Organization record keyed to the tenant ID ──────
  // Use a slug derived from the seedOrgId so it's always unique.
  const orgSlug = `org-${seedOrgId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 20)}`;
  await prisma.organization.upsert({
    where: { id: seedOrgId },
    update: { name: "FinRP Demo Org" },
    create: {
      id: seedOrgId,
      name: "FinRP Demo Org",
      slug: orgSlug,
      plan: Plan.STARTER,
    },
  });

  // ── User (optional — maps a Clerk ID to this org) ─────────────
  await prisma.user.upsert({
    where: { clerkId: seedOrgId },
    update: {},
    create: {
      clerkId: seedOrgId,
      email: "admin@finrp.com",
      name: "Admin User",
      role: Role.ADMIN,
      organizationId: seedOrgId,
    },
  });

  // ── Business Profile ──────────────────────────────────────────
  await prisma.businessProfile.upsert({
    where: { organizationId: seedOrgId },
    update: {},
    create: {
      organizationId: seedOrgId,
      businessName: "FinRP Technologies",
      registrationNo: "REG-123456",
      taxId: "TAX-998877",
      industry: "FinTech",
      country: "India",
      currency: "INR",
    },
  });

  // ── Customers ─────────────────────────────────────────────────
  const customer1 = await prisma.customer.create({
    data: {
      name: "John Doe",
      email: "john@example.com",
      phone: "+919999999999",
      company: "Acme Corp",
      organizationId: seedOrgId,
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      name: "Priya Sharma",
      email: "priya@startupco.in",
      phone: "+918888888888",
      company: "StartupCo",
      organizationId: seedOrgId,
    },
  });

  // ── Items (Inventory) ─────────────────────────────────────────
  const item1 = await prisma.item.create({
    data: {
      name: "Laptop",
      description: "Business Laptop",
      price: 75000,
      stock: 25,
      lowStockAt: 5,
      organizationId: seedOrgId,
    },
  });

  const item2 = await prisma.item.create({
    data: {
      name: "Wireless Mouse",
      description: "Ergonomic wireless mouse",
      price: 1200,
      stock: 4,           // below lowStockAt → triggers low-stock alert
      lowStockAt: 10,
      organizationId: seedOrgId,
    },
  });

  const item3 = await prisma.item.create({
    data: {
      name: "USB-C Hub",
      description: "7-in-1 USB-C Hub",
      price: 3500,
      stock: 18,
      lowStockAt: 5,
      organizationId: seedOrgId,
    },
  });

  // ── Invoices ──────────────────────────────────────────────────
  const invoice1 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-00001",
      customerId: customer1.id,
      organizationId: seedOrgId,
      status: InvoiceStatus.PAID,
      issueDate: new Date("2026-02-15"),
      dueDate: new Date("2026-03-01"),
      subtotal: 75000,
      taxRate: 18,
      taxAmount: 13500,
      total: 88500,
      items: {
        create: [
          { description: "Laptop x1", quantity: 1, unitPrice: 75000, amount: 75000 },
        ],
      },
    },
  });

  const invoice2 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-00002",
      customerId: customer2.id,
      organizationId: seedOrgId,
      status: InvoiceStatus.SENT,
      issueDate: new Date("2026-03-01"),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      subtotal: 8400,
      taxRate: 18,
      taxAmount: 1512,
      total: 9912,
      items: {
        create: [
          { description: "Wireless Mouse x7", quantity: 7, unitPrice: 1200, amount: 8400 },
        ],
      },
    },
  });

  const invoice3 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-00003",
      customerId: customer1.id,
      organizationId: seedOrgId,
      status: InvoiceStatus.OVERDUE,
      issueDate: new Date("2026-01-10"),
      dueDate: new Date("2026-02-10"),
      subtotal: 10500,
      taxRate: 18,
      taxAmount: 1890,
      total: 12390,
      items: {
        create: [
          { description: "USB-C Hub x3", quantity: 3, unitPrice: 3500, amount: 10500 },
        ],
      },
    },
  });

  // ── Payments ──────────────────────────────────────────────────
  await prisma.payment.create({
    data: {
      invoiceId: invoice1.id,
      organizationId: seedOrgId,
      amount: 88500,
      method: PaymentMethod.BANK_TRANSFER,
    },
  });

  // ── Compliance Tasks ──────────────────────────────────────────
  await prisma.complianceTask.createMany({
    data: [
      {
        title: "GST Filing — March 2026",
        description: "Monthly GST return filing",
        category: "TAX",
        status: "PENDING",
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        organizationId: seedOrgId,
      },
      {
        title: "Annual Audit Prep",
        description: "Prepare documents for FY 2025-26 audit",
        category: "AUDIT",
        status: "IN_PROGRESS",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        organizationId: seedOrgId,
      },
      {
        title: "Trade License Renewal",
        description: "Renew business trade license",
        category: "LICENSE",
        status: "PENDING",
        dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        organizationId: seedOrgId,
      },
    ],
  });

  // ── Transactions ──────────────────────────────────────────────
  await prisma.transaction.createMany({
    data: [
      { itemId: item1.id, organizationId: seedOrgId, type: TransactionType.SALE,    quantity: 1,  note: "Sold 1 laptop" },
      { itemId: item2.id, organizationId: seedOrgId, type: TransactionType.RESTOCK, quantity: 50, note: "Restocked mouse" },
      { itemId: item3.id, organizationId: seedOrgId, type: TransactionType.SALE,    quantity: 3,  note: "Sold 3 USB-C hubs" },
    ],
  });

  // ── Analytics Records ─────────────────────────────────────────
  await prisma.analyticsRecord.createMany({
    data: [
      { organizationId: seedOrgId, period: "2025-09", metric: "revenue", value: 41000 },
      { organizationId: seedOrgId, period: "2025-10", metric: "revenue", value: 56000 },
      { organizationId: seedOrgId, period: "2025-11", metric: "revenue", value: 49000 },
      { organizationId: seedOrgId, period: "2025-12", metric: "revenue", value: 73000 },
      { organizationId: seedOrgId, period: "2026-01", metric: "revenue", value: 62000 },
      { organizationId: seedOrgId, period: "2026-02", metric: "revenue", value: 88500 },
      { organizationId: seedOrgId, period: "2026-03", metric: "revenue", value: 0 },
    ],
  });

  console.log(`\n✅ Seed completed for tenant: ${seedOrgId}`);
  console.log("   Customers    : 2 (John Doe, Priya Sharma)");
  console.log("   Items        : 3 (Laptop, Wireless Mouse, USB-C Hub)");
  console.log("   Invoices     : 3 (PAID, SENT, OVERDUE)");
  console.log("   Compliance   : 3 tasks");
  console.log("   Transactions : 3 entries");
  console.log("   Analytics    : 7 monthly records");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });