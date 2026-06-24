// ============================================================
// CA Portal — My Clients
// Every customer actively assigned to this CA, with health +
// compliance scoring, last activity and search/filter.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getAssignedCustomers } from "@/lib/ca/portal";
import ClientsTable, { type ClientRow } from "./ClientsTable";

export default async function MyClientsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const clients = await getAssignedCustomers(user.id);

  const rows: ClientRow[] = clients.map((c) => ({
    id: c.customer.id,
    name: c.customer.name,
    company: c.customer.company ?? null,
    email: c.customer.email ?? null,
    phone: c.customer.phone ?? null,
    gstin: c.customer.gstin ?? null,
    onboarded: c.onboarded,
    healthScore: c.healthScore,
    complianceScore: c.complianceScore,
    lastActivityAt: c.lastActivityAt ? c.lastActivityAt.toISOString() : null,
    assignedAt: c.assignedAt.toISOString(),
    tasksOpen: c.taskCounts.open,
    tasksOverdue: c.taskCounts.overdue,
    complianceOverdue: c.complianceCounts.overdue,
    awaitingDocs: c.awaitingDocs,
  }));

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">My Clients</h1>
        <p className="section-subtitle">
          {rows.length} assigned client{rows.length !== 1 ? "s" : ""}
        </p>
      </div>
      <ClientsTable rows={rows} />
    </div>
  );
}
