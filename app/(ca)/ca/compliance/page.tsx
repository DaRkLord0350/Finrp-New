// ============================================================
// CA Portal — Compliance Center
// Statutory calendar across assigned clients (GST/TDS/ROC/ITR/PF/ESI).
// Views: Calendar · Upcoming · Overdue.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ComplianceCenter, { type EntryDTO, type CustomerOption } from "./ComplianceCenter";

export default async function CompliancePage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const assignments = await prisma.customerAssignment.findMany({
    where: { caId: user.id, isActive: true },
    include: { customer: { select: { id: true, name: true } } },
  });
  const customers: CustomerOption[] = assignments.map((a) => ({ id: a.customer.id, name: a.customer.name }));
  const customerIds = customers.map((c) => c.id);
  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  const entries = customerIds.length
    ? await prisma.complianceCalendarEntry.findMany({
        where: { customerId: { in: customerIds } },
        orderBy: { dueDate: "asc" },
      })
    : [];

  const dto: EntryDTO[] = entries.map((e) => ({
    id: e.id,
    customerId: e.customerId,
    customerName: nameById.get(e.customerId) ?? "Client",
    type: e.type,
    title: e.title,
    period: e.period,
    dueDate: e.dueDate.toISOString(),
    status: e.status,
    notes: e.notes,
  }));

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">Compliance Center</h1>
        <p className="section-subtitle">Track statutory deadlines across your client portfolio.</p>
      </div>
      <ComplianceCenter entries={dto} customers={customers} />
    </div>
  );
}
