import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Users } from "lucide-react";

async function getAllCustomers() {
  return prisma.customer.findMany({
    where: { deletedAt: null },
    include: {
      organization: { select: { name: true } },
      firm: { select: { name: true } },
      _count: {
        select: {
          customerAssignments: { where: { isActive: true } },
          firmTasks: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

const typeColor: Record<string, string> = {
  INDIVIDUAL: "#6366f1",
  BUSINESS: "#0ea5e9",
  WHOLESALE: "#10b981",
  RETAIL: "#f59e0b",
  GOVERNMENT: "#8b5cf6",
};

export default async function AdminCustomersPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "ADMIN") redirect("/dashboard");

  const customers = await getAllCustomers();

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">All Customers</h1>
        <p className="section-subtitle">{customers.length} total CRM customers across all organizations</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total", value: customers.length, color: "#6366f1" },
          { label: "Active", value: customers.filter((c) => c.isActive).length, color: "#10b981" },
          { label: "With Assignments", value: customers.filter((c) => c._count.customerAssignments > 0).length, color: "#0ea5e9" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {customers.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Users size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No customers yet</p>
          </div>
        </div>
      ) : (
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Type</th>
                <th>Organization</th>
                <th>Firm</th>
                <th>Tasks</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</p>
                    {c.email && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.email}</p>}
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
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.organization.name}</td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.firm?.name ?? "—"}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
