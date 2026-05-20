// ============================================================
// POST /api/erp/seed — Auto-seed ERP demo data
// Only seeds if org has no ERP data yet
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = orgId ?? userId;

    // Check if data already exists
    const existingSales = await prisma.sale.count({
      where: { organizationId: tenantId },
    });
    if (existingSales > 0) {
      return NextResponse.json({
        message: "ERP data already exists",
        seeded: false,
      });
    }

    // Ensure organization exists
    const org = await prisma.organization.findUnique({
      where: { id: tenantId },
    });
    if (!org) {
      // Create org if using userId fallback
      await prisma.organization.create({
        data: {
          id: tenantId,
          name: "My Organization",
          slug: `org-${tenantId.slice(0, 10)}`,
          plan: "STARTER",
        },
      });
    }

    // Get or create customers for linking
    let customers = await prisma.customer.findMany({
      where: { organizationId: tenantId },
      take: 3,
    });

    if (customers.length === 0) {
      await prisma.customer.createMany({
        data: [
          {
            name: "Amit Verma",
            email: "amit@techsolutions.in",
            phone: "+919876543210",
            company: "Tech Solutions Pvt Ltd",
            organizationId: tenantId,
          },
          {
            name: "Sneha Patel",
            email: "sneha@cloudworks.in",
            phone: "+919876543211",
            company: "CloudWorks India",
            organizationId: tenantId,
          },
          {
            name: "Rajesh Kumar",
            email: "rajesh@digihub.in",
            phone: "+919876543212",
            company: "DigiHub Services",
            organizationId: tenantId,
          },
        ],
      });
      customers = await prisma.customer.findMany({
        where: { organizationId: tenantId },
        take: 3,
      });
    }

    // Get or create inventory items
    let items = await prisma.item.findMany({
      where: { organizationId: tenantId },
      take: 5,
    });

    if (items.length === 0) {
      await prisma.item.createMany({
        data: [
          { name: "Business Laptop", description: "Dell Latitude 5540", price: 72000, stock: 15, lowStockAt: 5, organizationId: tenantId },
          { name: "Wireless Mouse", description: "Logitech MX Master 3S", price: 6500, stock: 3, lowStockAt: 10, organizationId: tenantId },
          { name: "Monitor 27\"", description: "LG UltraFine 4K", price: 32000, stock: 8, lowStockAt: 3, organizationId: tenantId },
          { name: "USB-C Docking Station", description: "Anker 575", price: 12500, stock: 20, lowStockAt: 5, organizationId: tenantId },
          { name: "Mechanical Keyboard", description: "Keychron K2 Pro", price: 8500, stock: 2, lowStockAt: 5, organizationId: tenantId },
        ],
      });
      items = await prisma.item.findMany({
        where: { organizationId: tenantId },
        take: 5,
      });
    }

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // ─── SALES (5 sales with items) ─────────────────────────
    const salesData = [
      {
        saleNumber: "SL-00001",
        customerId: customers[0]?.id,
        totalAmount: 150000,
        status: "COMPLETED" as const,
        saleDate: new Date(now.getFullYear(), now.getMonth(), 2),
        notes: "IT Infrastructure Setup",
        items: [
          { description: "Business Laptop x2", quantity: 2, unitPrice: 72000, amount: 144000, itemId: items[0]?.id },
          { description: "Wireless Mouse x1", quantity: 1, unitPrice: 6000, amount: 6000, itemId: items[1]?.id },
        ],
      },
      {
        saleNumber: "SL-00002",
        customerId: customers[1]?.id,
        totalAmount: 96000,
        status: "COMPLETED" as const,
        saleDate: new Date(now.getFullYear(), now.getMonth(), 5),
        notes: "Office Equipment Order",
        items: [
          { description: "Monitor 27\" x3", quantity: 3, unitPrice: 32000, amount: 96000, itemId: items[2]?.id },
        ],
      },
      {
        saleNumber: "SL-00003",
        customerId: customers[2]?.id,
        totalAmount: 45000,
        status: "COMPLETED" as const,
        saleDate: new Date(now.getFullYear(), now.getMonth(), 10),
        notes: "Peripheral Accessories Bundle",
        items: [
          { description: "USB-C Docking Station x2", quantity: 2, unitPrice: 12500, amount: 25000, itemId: items[3]?.id },
          { description: "Mechanical Keyboard x2", quantity: 2, unitPrice: 8500, amount: 17000, itemId: items[4]?.id },
          { description: "Cable management kit", quantity: 1, unitPrice: 3000, amount: 3000 },
        ],
      },
      {
        saleNumber: "SL-00004",
        customerId: customers[0]?.id,
        totalAmount: 25000,
        status: "PENDING" as const,
        saleDate: new Date(now.getFullYear(), now.getMonth(), 15),
        notes: "Software Licensing",
        items: [
          { description: "Annual software license", quantity: 5, unitPrice: 5000, amount: 25000 },
        ],
      },
      {
        saleNumber: "SL-00005",
        customerId: customers[1]?.id,
        totalAmount: 85000,
        status: "COMPLETED" as const,
        saleDate: new Date(now.getFullYear(), now.getMonth(), 18),
        notes: "Cloud Migration Consulting",
        items: [
          { description: "Cloud consulting (hours)", quantity: 40, unitPrice: 2125, amount: 85000 },
        ],
      },
    ];

    for (const sale of salesData) {
      await prisma.sale.create({
        data: {
          saleNumber: sale.saleNumber,
          customerId: sale.customerId || null,
          organizationId: tenantId,
          totalAmount: sale.totalAmount,
          status: sale.status,
          saleDate: sale.saleDate,
          notes: sale.notes,
          items: {
            create: sale.items.map((item) => ({
              itemId: item.itemId || null,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.amount,
            })),
          },
        },
      });
    }

    // ─── PURCHASES (2) ──────────────────────────────────────
    await prisma.purchase.createMany({
      data: [
        {
          purchaseNumber: "PO-00001",
          vendor: "Dell Technologies India",
          organizationId: tenantId,
          totalAmount: 360000,
          status: "RECEIVED",
          purchaseDate: new Date(now.getFullYear(), now.getMonth(), 1),
          notes: "Laptop restock — 5 units",
        },
        {
          purchaseNumber: "PO-00002",
          vendor: "Amazon Business India",
          organizationId: tenantId,
          totalAmount: 45000,
          status: "RECEIVED",
          purchaseDate: new Date(now.getFullYear(), now.getMonth(), 8),
          notes: "Office peripherals restock",
        },
      ],
    });

    // ─── EXPENSES (3) ───────────────────────────────────────
    await prisma.expense.createMany({
      data: [
        {
          category: "RENT",
          description: "Office rent — Bangalore HSR Layout",
          amount: 45000,
          organizationId: tenantId,
          expenseDate: new Date(now.getFullYear(), now.getMonth(), 1),
          vendor: "Prestige Properties",
        },
        {
          category: "SOFTWARE",
          description: "AWS hosting & services",
          amount: 12500,
          organizationId: tenantId,
          expenseDate: new Date(now.getFullYear(), now.getMonth(), 5),
          vendor: "Amazon Web Services",
        },
        {
          category: "MARKETING",
          description: "Google Ads — Lead Generation Campaign",
          amount: 28000,
          organizationId: tenantId,
          expenseDate: new Date(now.getFullYear(), now.getMonth(), 12),
          vendor: "Google India",
        },
      ],
    });

    // ─── PAYROLL (3 entries) ────────────────────────────────
    await prisma.payroll.createMany({
      data: [
        {
          employeeName: "Vikram Singh",
          designation: "Senior Developer",
          salary: 95000,
          bonus: 5000,
          deductions: 15000,
          netPay: 85000,
          organizationId: tenantId,
          payPeriod: currentPeriod,
        },
        {
          employeeName: "Ananya Rao",
          designation: "Product Manager",
          salary: 80000,
          bonus: 0,
          deductions: 12000,
          netPay: 68000,
          organizationId: tenantId,
          payPeriod: currentPeriod,
        },
        {
          employeeName: "Karthik Menon",
          designation: "DevOps Engineer",
          salary: 70000,
          bonus: 3000,
          deductions: 10000,
          netPay: 63000,
          organizationId: tenantId,
          payPeriod: currentPeriod,
        },
      ],
    });

    return NextResponse.json({
      message: "ERP demo data seeded successfully",
      seeded: true,
      counts: {
        sales: salesData.length,
        purchases: 2,
        expenses: 3,
        payroll: 3,
      },
    });
  } catch (error) {
    console.error("[POST /api/erp/seed]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
