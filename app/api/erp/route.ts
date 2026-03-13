import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get("organizationId")
  console.log("orgId from request:", organizationId)

  const profile = await prisma.businessProfile.findUnique({
    where: { organizationId: organizationId ?? "" }
  })

  // ✅ Log the DB result
  console.log("profile:", profile)
  if (!organizationId) {
    return NextResponse.json({ error: "Missing organizationId" }, { status: 400 })
  }

  const business = await prisma.businessProfile.findUnique({
    where: { organizationId }
  })

  if (!business) {
    return NextResponse.json({ error: "Business profile not found" }, { status: 404 })
  }

  // =========================
  // FINANCIAL METRICS
  // =========================

  const invoices = await prisma.invoice.findMany({
    where: { organizationId }
  })

  const payments = await prisma.payment.findMany({
    where: { organizationId }
  })

  const totalRevenue = payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  )

  const outstanding = invoices
    .filter(i => i.status !== "PAID")
    .reduce((sum, i) => sum + Number(i.total), 0)

  const invoiceCount = invoices.length

  // =========================
  // INVENTORY
  // =========================

  const items = await prisma.item.findMany({
    where: { organizationId }
  })

  const lowStock = items.filter(i => i.stock <= i.lowStockAt)

  // =========================
  // LOANS
  // =========================

  const loans = await prisma.loan.findMany({
    where: { organizationId }
  })

  const activeLoans = loans.filter(l => l.status === "ACTIVE")

  const totalLoanAmount = activeLoans.reduce(
    (sum, l) => sum + Number(l.loanAmount),
    0
  )

  // =========================
  // COMPLIANCE ALERTS
  // =========================

  const compliance = await prisma.complianceTask.findMany({
    where: {
      organizationId,
      status: "PENDING"
    },
    take: 5
  })

  const alerts = compliance.map(task => ({
    message: `${task.title} due on ${task.dueDate.toDateString()}`,
    severity: "warning"
  }))

  // =========================
  // RESPONSE
  // =========================

  return NextResponse.json({
    industry: business.industry,

    financialSummary: [
      {
        label: "Total Revenue",
        value: `$${totalRevenue.toLocaleString()}`
      },
      {
        label: "Outstanding Invoices",
        value: `$${outstanding.toLocaleString()}`
      },
      {
        label: "Total Invoices",
        value: invoiceCount
      },
      {
        label: "Active Loans",
        value: `$${totalLoanAmount.toLocaleString()}`
      }
    ],

    operations: [
      {
        label: "Items in Inventory",
        value: items.length
      },
      {
        label: "Low Stock Alerts",
        value: lowStock.length
      }
    ],

    alerts,

    aiSuggestions: [
      {
        title: "Reduce Inventory Risk",
        description: "Several items are approaching low stock levels."
      },
      {
        title: "Improve Cash Flow",
        description: "You have unpaid invoices that should be collected."
      }
    ]
  })
}