// ============================================================
// CA Portal — Dashboard
// Customer-centric command center: portfolio KPIs, onboarding
// funnel, today's priorities and recent workspace activity.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow, startOfDay, endOfDay } from "date-fns";
import {
  Users,
  UserPlus,
  ClipboardList,
  ShieldAlert,
  FileWarning,
  CalendarClock,
  Activity,
  ArrowRight,
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import {
  getAssignedCustomers,
  getOnboardingFunnel,
  getRecentActivity,
  healthLabel,
} from "@/lib/ca/portal";

const COMPLIANCE_COLOR: Record<string, string> = {
  GST: "#6366f1",
  TDS: "#0ea5e9",
  ROC: "#f59e0b",
  ITR: "#10b981",
  PF: "#8b5cf6",
  ESI: "#ec4899",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

export default async function CADashboardPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const clients = await getAssignedCustomers(user.id);
  const customerIds = clients.map((c) => c.customer.id);
  const now = new Date();

  const [funnel, recent, tasksDueToday, complianceDue] = await Promise.all([
    getOnboardingFunnel(user.id),
    getRecentActivity(user.id, 8),
    prisma.firmTask.findMany({
      where: {
        assignedCaId: user.id,
        status: { not: "COMPLETED" },
        dueDate: { gte: startOfDay(now), lte: endOfDay(now) },
      },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    customerIds.length
      ? prisma.complianceCalendarEntry.findMany({
          where: {
            customerId: { in: customerIds },
            status: { not: "COMPLETED" },
            dueDate: { lte: endOfDay(now) },
          },
          orderBy: { dueDate: "asc" },
          take: 6,
        })
      : Promise.resolve([]),
  ]);

  const customerName = new Map(clients.map((c) => [c.customer.id, c.customer.name]));

  // ── KPIs ────────────────────────────────────────────────────
  const pendingOnboarding = clients.filter((c) => !c.onboarded).length;
  const pendingTasks = clients.reduce((a, c) => a + c.taskCounts.open, 0);
  const complianceDueCount = clients.reduce(
    (a, c) => a + c.complianceCounts.overdue + c.complianceCounts.dueSoon,
    0
  );
  const awaitingDocuments = clients.reduce((a, c) => a + c.awaitingDocs, 0);

  const kpis = [
    { label: "Assigned Clients", value: clients.length, icon: Users, color: "#6366f1", href: "/ca/clients" },
    { label: "Pending Onboarding", value: pendingOnboarding, icon: UserPlus, color: "#0ea5e9", href: "/ca/clients" },
    { label: "Pending Tasks", value: pendingTasks, icon: ClipboardList, color: "#f59e0b", href: "/ca/tasks" },
    { label: "Compliance Due", value: complianceDueCount, icon: ShieldAlert, color: "#ef4444", href: "/ca/compliance" },
    { label: "Awaiting Documents", value: awaitingDocuments, icon: FileWarning, color: "#f97316", href: "/ca/documents" },
  ];

  const funnelStages = [
    { label: "Sent", value: funnel.sent, color: "#6366f1" },
    { label: "Viewed", value: funnel.viewed, color: "#0ea5e9" },
    { label: "Accepted", value: funnel.accepted, color: "#f59e0b" },
    { label: "Completed", value: funnel.completed, color: "#10b981" },
  ];
  const funnelMax = Math.max(funnel.sent, 1);

  // Merge priorities (overdue/today tasks + compliance) for the widget.
  const priorities = [
    ...tasksDueToday.map((t) => ({
      id: t.id,
      kind: "Task" as const,
      title: t.title,
      who: t.customer.name,
      dueDate: t.dueDate,
      color: "#f59e0b",
    })),
    ...complianceDue.map((c) => ({
      id: c.id,
      kind: c.type as string,
      title: c.title,
      who: customerName.get(c.customerId) ?? "Client",
      dueDate: c.dueDate,
      color: COMPLIANCE_COLOR[c.type] ?? "#ef4444",
    })),
  ]
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 7);

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title" style={{ fontSize: 24 }}>
          Good {greeting()}, {user.name?.split(" ")[0] ?? "CA"}
        </h1>
        <p className="section-subtitle">
          {format(now, "EEEE, dd MMMM yyyy")} — your client portfolio at a glance
        </p>
      </div>

      {/* KPI cards */}
      <div
        className="stagger"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} href={k.href} style={{ textDecoration: "none" }}>
              <div className="stat-card animate-fade-in" style={{ cursor: "pointer" }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `${k.color}1a`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <Icon size={18} color={k.color} />
                </div>
                <p style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                  {k.value}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{k.label}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Onboarding funnel */}
      <div className="section-card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <ListChecks size={16} color="#6366f1" />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            Onboarding Funnel
          </h2>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
            {funnel.total} invitation{funnel.total !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {funnelStages.map((s, i) => {
            const pct = Math.round((s.value / funnelMax) * 100);
            const conv = i === 0 ? 100 : Math.round((s.value / Math.max(funnelStages[0].value, 1)) * 100);
            return (
              <div key={s.label}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{conv}%</span>
                </div>
                <p style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1, marginBottom: 8 }}>
                  {s.value}
                </p>
                <div style={{ height: 6, borderRadius: 99, background: "var(--bg-overlay)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: s.color, borderRadius: 99, transition: "width .4s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-column: priorities + activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Today's priorities */}
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <CalendarClock size={16} color="#ef4444" />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Today&apos;s Priorities</h2>
          </div>
          {priorities.length === 0 ? (
            <div className="empty-state" style={{ padding: "32px 16px" }}>
              <CheckCircle2 size={32} color="var(--success, #10b981)" />
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Nothing urgent today. You&apos;re all caught up.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {priorities.map((p) => {
                const overdue = p.dueDate < startOfDay(now);
                return (
                  <div
                    key={`${p.kind}-${p.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: p.color,
                        background: `${p.color}1a`,
                        padding: "3px 7px",
                        borderRadius: 6,
                        flexShrink: 0,
                        letterSpacing: "0.03em",
                      }}
                    >
                      {p.kind.toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.title}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.who}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: overdue ? "#ef4444" : "var(--text-muted)", flexShrink: 0 }}>
                      {overdue ? "Overdue" : format(p.dueDate, "h:mm a")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Activity size={16} color="#0ea5e9" />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Recent Activity</h2>
          </div>
          {recent.length === 0 ? (
            <div className="empty-state" style={{ padding: "32px 16px" }}>
              <Activity size={32} color="var(--text-muted)" />
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No workspace activity yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recent.map((r) => (
                <div
                  key={r.id}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}
                >
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#0ea5e9", marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{r.summary}</p>
                    <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 1 }}>
                      {formatDistanceToNow(r.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Portfolio shortcut */}
      {clients.length > 0 && (
        <div className="section-card" style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={16} color="#6366f1" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Clients Needing Attention</h2>
            </div>
            <Link href="/ca/clients" style={{ fontSize: 12, color: "var(--brand-400, #818cf8)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clients
              .slice()
              .sort((a, b) => a.healthScore - b.healthScore)
              .slice(0, 5)
              .map((c) => {
                const h = healthLabel(c.healthScore);
                return (
                  <Link key={c.customer.id} href={`/ca/clients/${c.customer.id}`} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.customer.name}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {c.taskCounts.overdue > 0 && `${c.taskCounts.overdue} overdue task${c.taskCounts.overdue !== 1 ? "s" : ""} · `}
                          {c.complianceCounts.overdue > 0 && `${c.complianceCounts.overdue} compliance overdue · `}
                          {c.awaitingDocs > 0 && `${c.awaitingDocs} doc${c.awaitingDocs !== 1 ? "s" : ""} pending`}
                          {c.taskCounts.overdue === 0 && c.complianceCounts.overdue === 0 && c.awaitingDocs === 0 && "On track"}
                        </p>
                      </div>
                      <span className="badge" style={{ background: h.bg, color: h.color, borderColor: `${h.color}30` }}>
                        {c.healthScore}
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
