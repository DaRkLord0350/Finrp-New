import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { ChevronLeft, UserPlus, UserMinus, ClipboardList } from "lucide-react";
import Link from "next/link";

async function getCustomerHistory(customerId: string, orgId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: orgId },
    select: { id: true, name: true, email: true, company: true, createdAt: true },
  });
  if (!customer) return null;

  const [assignments, tasks] = await Promise.all([
    prisma.customerAssignment.findMany({
      where: { customerId },
      include: {
        ca: { select: { id: true, name: true, email: true } },
        assignedBy: { select: { id: true, name: true } },
      },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.firmTask.findMany({
      where: { customerId, organizationId: orgId },
      include: { assignedCa: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return { customer, assignments, tasks };
}

const statusColor: Record<string, string> = {
  PENDING: "#f59e0b", IN_PROGRESS: "#3b82f6", WAITING_CLIENT: "#f97316",
  REVIEW: "#8b5cf6", COMPLETED: "#10b981",
};

export default async function CustomerHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const data = await getCustomerHistory(id, user.organizationId);
  if (!data) redirect("/firm/customers");

  const { customer, assignments, tasks } = data;
  const activeAssignment = assignments.find((a) => a.isActive);

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <Link href="/firm/customers" style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: 13, textDecoration: "none" }}>
          <ChevronLeft size={14} /> Customers
        </Link>
        <span style={{ color: "var(--border)" }}>/</span>
        <h1 className="section-title" style={{ fontSize: 20, margin: 0 }}>{customer.name} — Assignment History</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        {/* Assignment Timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="section-card">
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 18 }}>
              Assignment Timeline ({assignments.length} record{assignments.length !== 1 ? "s" : ""})
            </h3>

            {assignments.length === 0 ? (
              <div className="empty-state" style={{ padding: "32px 0" }}>
                <UserPlus size={36} color="var(--text-muted)" />
                <p style={{ color: "var(--text-muted)" }}>No assignment history yet</p>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                {/* Timeline line */}
                <div style={{ position: "absolute", left: 15, top: 12, bottom: 12, width: 2, background: "var(--border)" }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {assignments.map((a, i) => (
                    <div key={a.id} style={{ display: "flex", gap: 20, paddingBottom: i < assignments.length - 1 ? 24 : 0 }}>
                      {/* Dot */}
                      <div style={{ flexShrink: 0, width: 32, display: "flex", justifyContent: "center", paddingTop: 2 }}>
                        <div style={{ width: 14, height: 14, borderRadius: "50%", background: a.isActive ? "#10b981" : "var(--bg-elevated)", border: `2px solid ${a.isActive ? "#10b981" : "var(--border)"}`, zIndex: 1 }} />
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: 10, border: `1px solid ${a.isActive ? "rgba(16,185,129,0.3)" : "var(--border)"}` }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {a.isActive ? <UserPlus size={13} color="#10b981" /> : <UserMinus size={13} color="var(--text-muted)" />}
                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                              {a.isActive ? "Currently assigned to" : "Was assigned to"} {a.ca.name ?? a.ca.email}
                            </p>
                          </div>
                          {a.isActive && (
                            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                              Active
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                          Assigned {format(new Date(a.assignedAt), "dd MMM yyyy, HH:mm")}
                          {a.unassignedAt && ` · Unassigned ${format(new Date(a.unassignedAt), "dd MMM yyyy")}`}
                        </p>
                        {a.reason && <p style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>&ldquo;{a.reason}&rdquo;</p>}
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                          By {a.assignedBy.name ?? "System"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Task History */}
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <ClipboardList size={15} color="#6366f1" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Task History ({tasks.length})</h3>
            </div>
            {tasks.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No tasks found for this client.</p>
            ) : (
              <div style={{ padding: 0, overflow: "hidden" }}>
                <table className="data-table">
                  <thead><tr><th>Task</th><th>CA</th><th>Due</th><th>Status</th></tr></thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id}>
                        <td style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{task.title}</td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{task.assignedCa.name ?? "—"}</td>
                        <td style={{ fontSize: 12, color: task.dueDate < new Date() && task.status !== "COMPLETED" ? "#ef4444" : "var(--text-muted)" }}>
                          {format(new Date(task.dueDate), "dd MMM yyyy")}
                        </td>
                        <td>
                          <span className="badge" style={{ background: `${statusColor[task.status]}18`, color: statusColor[task.status], borderColor: `${statusColor[task.status]}30` }}>
                            {task.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right — Client Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="section-card">
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Client Info</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Name", value: customer.name },
                { label: "Email", value: customer.email },
                { label: "Company", value: customer.company },
                { label: "Client since", value: format(new Date(customer.createdAt), "dd MMM yyyy") },
                { label: "Current CA", value: activeAssignment ? (activeAssignment.ca.name ?? activeAssignment.ca.email) : "Unassigned" },
                { label: "Total Assignments", value: `${assignments.length} record${assignments.length !== 1 ? "s" : ""}` },
              ].map((f) => (
                <div key={f.label}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{f.label}</p>
                  <p style={{ fontSize: 13, color: f.value ? "var(--text-primary)" : "var(--text-muted)" }}>{f.value ?? "—"}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="section-card">
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Task Summary</h3>
            {["PENDING", "IN_PROGRESS", "COMPLETED", "WAITING_CLIENT", "REVIEW"].map((s) => {
              const count = tasks.filter((t) => t.status === s).length;
              return (
                <div key={s} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s.replace("_", " ")}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: statusColor[s] }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
