// ============================================================
// CA Portal — Agreements
// Firm + Customer engagement summaries per client: service scope,
// renewal date, monthly fee, SLA and notes.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AgreementsManager, { type AgreementDTO, type CustomerOption } from "./AgreementsManager";

export default async function AgreementsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const assignments = await prisma.customerAssignment.findMany({
    where: { caId: user.id, isActive: true },
    include: { customer: { select: { id: true, name: true, company: true } } },
    orderBy: { assignedAt: "desc" },
  });
  const customers: CustomerOption[] = assignments.map((a) => ({ id: a.customer.id, name: a.customer.name, company: a.customer.company }));
  const customerIds = customers.map((c) => c.id);

  const agreements = customerIds.length
    ? await prisma.clientAgreementSummary.findMany({ where: { customerId: { in: customerIds } } })
    : [];

  const dto: AgreementDTO[] = agreements.map((a) => ({
    id: a.id,
    customerId: a.customerId,
    kind: a.kind,
    serviceScope: a.serviceScope,
    renewalDate: a.renewalDate ? a.renewalDate.toISOString().slice(0, 10) : null,
    monthlyFee: a.monthlyFee != null ? Number(a.monthlyFee) : null,
    slaHours: a.slaHours,
    notes: a.notes,
    status: a.status,
  }));

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">Agreements</h1>
        <p className="section-subtitle">Engagement terms for each client — firm and customer agreements.</p>
      </div>
      <AgreementsManager customers={customers} agreements={dto} />
    </div>
  );
}
