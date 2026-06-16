import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  History,
  ShieldCheck,
} from "lucide-react";
import { AssignmentPanel } from "@/components/firm/customer/AssignmentPanel";
import { CustomerVault } from "@/components/firm/vault/CustomerVault";

const statusColor: Record<string, string> = {
  PENDING: "#f59e0b",
  IN_PROGRESS: "#3b82f6",
  WAITING_CLIENT: "#f97316",
  REVIEW: "#8b5cf6",
  COMPLETED: "#10b981",
};

export default async function Customer360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      firm: { select: { id: true, name: true } },
      customerAssignments: {
        where: { isActive: true },
        include: { ca: { select: { id: true, name: true, email: true } } },
        take: 1,
      },
      _count: { select: { vaultDocuments: true } },
    },
  });
  if (!customer) notFound();

  const [tasks, history, caUsers] = await Promise.all([
    prisma.firmTask.findMany({
      where: { customerId: id },
      include: { assignedCa: { select: { name: true, email: true } } },
      orderBy: { dueDate: "asc" },
      take: 25,
    }),
    prisma.customerAssignment.findMany({
      where: { customerId: id },
      include: {
        ca: { select: { name: true, email: true } },
        assignedBy: { select: { name: true } },
      },
      orderBy: { assignedAt: "desc" },
      take: 20,
    }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] }, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const now = new Date();
  const openTasks = tasks.filter((t) => t.status !== "COMPLETED").length;
  const overdue = tasks.filter((t) => t.status !== "COMPLETED" && t.dueDate < now).length;
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  const compliance =
    overdue > 0 ? { label: "At Risk", color: "#ef4444" } : openTasks > 0 ? { label: "In Progress", color: "#f59e0b" } : { label: "Compliant", color: "#10b981" };

  const active = customer.customerAssignments[0];
  const activeAssignment = active
    ? { id: active.id, caId: active.caId, caName: active.ca.name ?? active.ca.email }
    : null;

  return (
    <div className="page-container animate-fade-in">
      <Link
        href="/firm/customers"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", textDecoration: "none", marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> Back to Customers
      </Link>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "rgba(99,102,241,0.15)",
              color: "#6366f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="section-title" style={{ marginBottom: 2 }}>{customer.name}</h1>
            <p className="section-subtitle">
              {customer.company ?? customer.customerType} ·{" "}
              {customer.firm ? `Linked to ${customer.firm.name}` : "Not linked to a firm"}
            </p>
          </div>
        </div>
        <span className="badge" style={{ background: `${compliance.color}18`, color: compliance.color, borderColor: `${compliance.color}30` }}>
          <ShieldCheck size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
          {compliance.label}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Open Tasks", value: openTasks, color: "#6366f1", icon: ClipboardList },
          { label: "Overdue", value: overdue, color: "#ef4444", icon: AlertTriangle },
          { label: "Completed", value: completed, color: "#10b981", icon: CheckCircle2 },
          { label: "Documents", value: customer._count.vaultDocuments, color: "#0ea5e9", icon: Building2 },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="stat-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <Icon size={16} color={s.color} />
              </div>
              <p style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Tasks */}
          <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <ClipboardList size={16} color="#6366f1" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Tasks</h2>
              <Link href="/firm/tasks" style={{ marginLeft: "auto", fontSize: 12, color: "var(--brand-400)", textDecoration: "none" }}>
                Manage
              </Link>
            </div>
            {tasks.length === 0 ? (
              <div className="empty-state" style={{ padding: "28px 20px" }}>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No tasks for this customer yet.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>CA</th>
                    <th>Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                        <Link href={`/firm/tasks/${t.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {t.title}
                        </Link>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.assignedCa.name ?? "—"}</td>
                      <td style={{ fontSize: 12, color: t.dueDate < now && t.status !== "COMPLETED" ? "#ef4444" : "var(--text-muted)" }}>
                        {format(t.dueDate, "dd MMM")}
                      </td>
                      <td>
                        <span className="badge" style={{ background: `${statusColor[t.status]}18`, color: statusColor[t.status], borderColor: `${statusColor[t.status]}30` }}>
                          {t.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Document Vault (Phase 5) */}
          <CustomerVault customerId={customer.id} />
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <AssignmentPanel
            customerId={customer.id}
            active={activeAssignment}
            caUsers={caUsers}
            firmLinked={!!customer.firmId}
          />

          {/* Contact */}
          <div className="section-card">
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Details</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {customer.email && <DetailRow icon={<Mail size={14} />} value={customer.email} />}
              {customer.phone && <DetailRow icon={<Phone size={14} />} value={customer.phone} />}
              {(customer.city || customer.state) && (
                <DetailRow icon={<MapPin size={14} />} value={[customer.city, customer.state].filter(Boolean).join(", ")} />
              )}
              {customer.gstin && <DetailRow icon={<Building2 size={14} />} value={`GSTIN ${customer.gstin}`} />}
            </div>
          </div>

          {/* Assignment history */}
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <History size={16} color="#8b5cf6" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Assignment History</h2>
            </div>
            {history.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No assignment history.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {history.map((h) => (
                  <div key={h.id} style={{ display: "flex", gap: 10 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: h.isActive ? "#10b981" : "var(--text-muted)", marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12.5, color: "var(--text-primary)" }}>
                        {h.ca.name ?? h.ca.email}
                        {h.isActive && <span style={{ color: "#10b981", fontSize: 10, marginLeft: 6 }}>ACTIVE</span>}
                      </p>
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                        {format(h.assignedAt, "dd MMM yyyy")} by {h.assignedBy.name ?? "—"}
                        {h.unassignedAt && ` · ended ${format(h.unassignedAt, "dd MMM")}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-secondary)" }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13 }}>{value}</span>
    </div>
  );
}
