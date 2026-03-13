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
  TaskStatus
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {

  const seedOrgId = process.env.SEED_ORG_ID;

  if (!seedOrgId) {
    console.error(`
❌ SEED_ORG_ID is not set

Visit:
http://localhost:3000/api/debug/tenant

Then run:

$env:SEED_ORG_ID="<tenantId>"; npx prisma db seed
`);
    process.exit(1);
  }

  console.log(`🌱 Seeding org: ${seedOrgId}`);

  // -------------------------------------------------------
  // CLEANUP (Respect foreign key order)
  // -------------------------------------------------------

  await prisma.loanPayment.deleteMany({});
  await prisma.loan.deleteMany({ where: { organizationId: seedOrgId } });

  await prisma.analyticsRecord.deleteMany({ where: { organizationId: seedOrgId } });
  await prisma.transaction.deleteMany({ where: { organizationId: seedOrgId } });
  await prisma.complianceTask.deleteMany({ where: { organizationId: seedOrgId } });
  await prisma.payment.deleteMany({ where: { organizationId: seedOrgId } });
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({ where: { organizationId: seedOrgId } });
  await prisma.item.deleteMany({ where: { organizationId: seedOrgId } });
  await prisma.customer.deleteMany({ where: { organizationId: seedOrgId } });

  // -------------------------------------------------------
  // ORGANIZATION
  // -------------------------------------------------------

  const orgSlug = `org-${seedOrgId.slice(0, 10)}`;

  await prisma.organization.upsert({
    where: { id: seedOrgId },
    update: {},
    create: {
      id: seedOrgId,
      name: "FinRP Demo Org",
      slug: orgSlug,
      plan: Plan.STARTER
    }
  });

  // -------------------------------------------------------
  // USER
  // -------------------------------------------------------

  await prisma.user.upsert({
    where: { clerkId: seedOrgId },
    update: {},
    create: {
      clerkId: seedOrgId,
      email: "admin@finrp.com",
      name: "Admin",
      role: Role.ADMIN,
      organizationId: seedOrgId
    }
  });

  // -------------------------------------------------------
  // BUSINESS PROFILE
  // -------------------------------------------------------

  await prisma.businessProfile.upsert({
    where: { organizationId: seedOrgId },
    update: {},
    create: {
      organizationId: seedOrgId,
      businessName: "FinRP Technologies",
      registrationNo: "REG-554433",
      taxId: "GST-998877",
      industry: "FinTech",
      country: "India",
      currency: "INR"
    }
  });

  // -------------------------------------------------------
  // BUSINESS (Onboarding)
  // -------------------------------------------------------

  await prisma.business.upsert({
    where: { clerkId: seedOrgId },
    update: {},
    create: {
      clerkId: seedOrgId,
      name: "FinRP Demo Business",
      type: "Private Limited",
      industry: "FinTech",
      address: "Bangalore, India",
      country: "India",
      currency: "INR",
      taxId: "GST-998877"
    }
  });

  // -------------------------------------------------------
  // CUSTOMERS
  // -------------------------------------------------------

  const john = await prisma.customer.create({
    data: {
      name: "John Doe",
      email: "john@example.com",
      phone: "+919999999999",
      company: "Acme Corp",
      organizationId: seedOrgId
    }
  });

  const priya = await prisma.customer.create({
    data: {
      name: "Priya Sharma",
      email: "priya@startupco.in",
      phone: "+918888888888",
      company: "StartupCo",
      organizationId: seedOrgId
    }
  });

  // -------------------------------------------------------
  // INVENTORY ITEMS
  // -------------------------------------------------------

  const laptop = await prisma.item.create({
    data: {
      name: "Laptop",
      description: "Business Laptop",
      price: 75000,
      stock: 25,
      organizationId: seedOrgId
    }
  });

  const mouse = await prisma.item.create({
    data: {
      name: "Wireless Mouse",
      description: "Ergonomic Mouse",
      price: 1200,
      stock: 4,
      lowStockAt: 10,
      organizationId: seedOrgId
    }
  });

  const hub = await prisma.item.create({
    data: {
      name: "USB-C Hub",
      description: "7 in 1 USB-C Hub",
      price: 3500,
      stock: 18,
      organizationId: seedOrgId
    }
  });

  // -------------------------------------------------------
  // INVOICE
  // -------------------------------------------------------

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-0001",
      customerId: john.id,
      organizationId: seedOrgId,
      status: InvoiceStatus.PAID,
      dueDate: new Date(),
      subtotal: 75000,
      taxRate: 18,
      taxAmount: 13500,
      total: 88500,
      items: {
        create: [
          {
            description: "Laptop x1",
            quantity: 1,
            unitPrice: 75000,
            amount: 75000
          }
        ]
      }
    }
  });

  // -------------------------------------------------------
  // PAYMENT
  // -------------------------------------------------------

  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      organizationId: seedOrgId,
      amount: 88500,
      method: PaymentMethod.BANK_TRANSFER
    }
  });

  // -------------------------------------------------------
  // COMPLIANCE TASKS
  // -------------------------------------------------------

  await prisma.complianceTask.createMany({
    data: [
      {
        title: "GST Filing",
        category: ComplianceCategory.TAX,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 5 * 86400000),
        organizationId: seedOrgId
      },
      {
        title: "Annual Audit",
        category: ComplianceCategory.AUDIT,
        status: TaskStatus.IN_PROGRESS,
        dueDate: new Date(Date.now() + 30 * 86400000),
        organizationId: seedOrgId
      }
    ]
  });

  // -------------------------------------------------------
  // INVENTORY TRANSACTIONS
  // -------------------------------------------------------

  await prisma.transaction.createMany({
    data: [
      {
        itemId: laptop.id,
        organizationId: seedOrgId,
        type: TransactionType.SALE,
        quantity: 1
      },
      {
        itemId: mouse.id,
        organizationId: seedOrgId,
        type: TransactionType.RESTOCK,
        quantity: 50
      },
      {
        itemId: hub.id,
        organizationId: seedOrgId,
        type: TransactionType.SALE,
        quantity: 3
      }
    ]
  });

  // -------------------------------------------------------
  // LOANS
  // -------------------------------------------------------

  const loan = await prisma.loan.create({
    data: {
      organizationId: seedOrgId,
      loanAmount: 2500000,
      principalAmount: 2300000,
      interestRate: 11.5,
      tenure: 36,
      loanType: "Working Capital",
      bank: "State Bank of India",
      processingFee: 2,
      monthlyEMI: 78000,
      status: LoanStatus.ACTIVE,
      startDate: new Date(),
      endDate: new Date(Date.now() + 36 * 30 * 86400000)
    }
  });

  // -------------------------------------------------------
  // LOAN PAYMENTS
  // -------------------------------------------------------

  await prisma.loanPayment.createMany({
    data: [
      {
        loanId: loan.id,
        amount: 78000,
        paidAmount: 78000,
        status: PaymentStatus.PAID,
        dueDate: new Date("2026-01-01"),
        paidDate: new Date("2026-01-01")
      },
      {
        loanId: loan.id,
        amount: 78000,
        paidAmount: 78000,
        status: PaymentStatus.PAID,
        dueDate: new Date("2026-02-01"),
        paidDate: new Date("2026-02-01")
      },
      {
        loanId: loan.id,
        amount: 78000,
        paidAmount: 0,
        status: PaymentStatus.PENDING,
        dueDate: new Date("2026-03-01")
      }
    ]
  });

  // -------------------------------------------------------
  // ANALYTICS
  // -------------------------------------------------------

  await prisma.analyticsRecord.createMany({
    data: [
      { organizationId: seedOrgId, period: "2025-12", metric: "revenue", value: 73000 },
      { organizationId: seedOrgId, period: "2026-01", metric: "revenue", value: 62000 },
      { organizationId: seedOrgId, period: "2026-02", metric: "revenue", value: 88500 },
      { organizationId: seedOrgId, period: "2026-03", metric: "revenue", value: 0 }
    ]
  });

  console.log("✅ FinRP seed completed");
}

main()
.catch(e=>{
  console.error(e);
  process.exit(1);
})
.finally(async ()=>{
  await prisma.$disconnect();
});