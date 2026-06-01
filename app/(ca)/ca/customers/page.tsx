import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Users, Mail, Phone, ClipboardList } from "lucide-react";

async function getAssignedCustomers(caId: string) {
  return prisma.customerAssignment.findMany({
    where: { caId, isActive: true },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          customerType: true,
          isActive: true,
          _count: {
            select: {
              firmTasks: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function getTaskCountsByCustomer(caId: string, customerIds: string[]) {
  const counts = await prisma.firmTask.groupBy({
    by: ["customerId"],
    where: {
      assignedCaId: caId,
      customerId: { in: customerIds },
      status: { not: "COMPLETED" },
    },
    _count: { _all: true },
  });
  return Object.fromEntries(counts.map((c) => [c.customerId, c._count._all]));
}

const typeColor: Record<string, string> = {
  INDIVIDUAL: "#6366f1",
  BUSINESS: "#0ea5e9",
  WHOLESALE: "#10b981",
  RETAIL: "#f59e0b",
  GOVERNMENT: "#8b5cf6",
};

export default async function CACustomersPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  // CRITICAL: Only show assigned customers
  const assignments = await getAssignedCustomers(user.id);
  const customerIds = assignments.map((a) => a.customer.id);
  const pendingCounts = await getTaskCountsByCustomer(user.id, customerIds);

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">My Customers</h1>
        <p className="section-subtitle">
          {assignments.length} customer{assignments.length !== 1 ? "s" : ""} assigned to you
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Assigned", value: assignments.length, color: "#6366f1" },
          { label: "With Open Tasks", value: Object.keys(pendingCounts).length, color: "#f59e0b" },
          { label: "All Clear", value: assignments.length - Object.keys(pendingCounts).length, color: "#10b981" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {assignments.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Users size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              No customers assigned
            </p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 320, textAlign: "center" }}>
              Your firm admin will assign customers to you. Check back later.
            </p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Open Tasks</th>
                <th>Total Tasks</th>
                <th>Status</th>
                <th>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const c = a.customer;
                const openTasks = pendingCounts[c.id] ?? 0;
                return (
                  <tr key={a.id}>
                    <td>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</p>
                        {c.company && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.company}</p>}
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: `${typeColor[c.customerType] ?? "#94a3b8"}18`,
                          color: typeColor[c.customerType] ?? "#94a3b8",
                          borderColor: `${typeColor[c.customerType] ?? "#94a3b8"}30`,
                        }}
                      >
                        {c.customerType}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        {c.email && (
                          <p style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)" }}>
                            <Mail size={10} /> {c.email}
                          </p>
                        )}
                        {c.phone && (
                          <p style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-muted)" }}>
                            <Phone size={10} /> {c.phone}
                          </p>
                        )}
                        {!c.email && !c.phone && <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </div>
                    </td>
                    <td>
                      {openTasks > 0 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <ClipboardList size={12} color="#f59e0b" />
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>{openTasks}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "#10b981" }}>✓ Clear</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {c._count.firmTasks}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: c.isActive ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                          color: c.isActive ? "#10b981" : "#ef4444",
                          borderColor: c.isActive ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
                        }}
                      >
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {format(a.createdAt, "dd MMM yyyy")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
