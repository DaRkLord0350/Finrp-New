import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format, isToday, isSameMonth, addMonths } from "date-fns";
import { Calendar, AlertTriangle, Clock, CalendarDays } from "lucide-react";

async function getCADeadlines(caUserId: string) {
  const orgIds = await prisma.cAClient.findMany({
    where: { caUserId, isActive: true },
    select: { organizationId: true },
  }).then((r) => r.map((c) => c.organizationId));

  if (orgIds.length === 0) return [];

  return prisma.complianceSubmission.findMany({
    where: {
      organizationId: { in: orgIds },
      deletedAt: null,
      dueDate: { not: null },
      status: { notIn: ["APPROVED", "COMPLETED"] },
    },
    include: {
      organization: { include: { businessProfile: true } },
      category: { select: { name: true, code: true } },
    },
    orderBy: { dueDate: "asc" },
  });
}

function getDeadlineStatus(dueDate: Date): { label: string; color: string; bg: string } {
  const now = new Date();
  if (dueDate < now) return { label: "Overdue", color: "#dc2626", bg: "rgba(220,38,38,0.1)" };
  if (isToday(dueDate)) return { label: "Due Today", color: "#ef4444", bg: "rgba(239,68,68,0.1)" };
  const diff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 3) return { label: `${diff}d left`, color: "#f97316", bg: "rgba(249,115,22,0.1)" };
  if (diff <= 7) return { label: `${diff}d left`, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" };
  if (diff <= 30) return { label: `${diff}d left`, color: "#3b82f6", bg: "rgba(59,130,246,0.1)" };
  return { label: format(dueDate, "dd MMM"), color: "#10b981", bg: "rgba(16,185,129,0.1)" };
}

function categoryColor(code: string): string {
  const colors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#f97316"];
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = code.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default async function CADeadlinesPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const deadlines = await getCADeadlines(user.id);

  const now = new Date();
  const nextMonth = addMonths(now, 1);

  const overdue = deadlines.filter((d) => d.dueDate! < now);
  const today = deadlines.filter((d) => d.dueDate! >= now && isToday(d.dueDate!));
  const thisMonth = deadlines.filter((d) => d.dueDate! >= now && !isToday(d.dueDate!) && isSameMonth(d.dueDate!, now));
  const nextMonthItems = deadlines.filter((d) => isSameMonth(d.dueDate!, nextMonth));
  const beyond = deadlines.filter((d) => d.dueDate! > nextMonth && !isSameMonth(d.dueDate!, nextMonth));

  const sections = [
    { title: "Overdue", items: overdue, icon: AlertTriangle, color: "#dc2626" },
    { title: "Today", items: today, icon: Clock, color: "#ef4444" },
    { title: `This Month — ${format(now, "MMMM yyyy")}`, items: thisMonth, icon: CalendarDays, color: "#f97316" },
    { title: `Next Month — ${format(nextMonth, "MMMM yyyy")}`, items: nextMonthItems, icon: Calendar, color: "#3b82f6" },
    { title: "Beyond", items: beyond, icon: Calendar, color: "#10b981" },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Deadlines</h1>
        <p className="section-subtitle">
          {deadlines.length} upcoming filing{deadlines.length !== 1 ? "s" : ""} —{" "}
          {overdue.length > 0 && (
            <span style={{ color: "#dc2626", fontWeight: 600 }}>{overdue.length} overdue</span>
          )}
        </p>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Overdue", value: overdue.length, color: "#dc2626" },
          { label: "Due Today", value: today.length, color: "#ef4444" },
          { label: "This Month", value: thisMonth.length, color: "#f97316" },
          { label: "Next Month", value: nextMonthItems.length, color: "#3b82f6" },
          { label: "Beyond", value: beyond.length, color: "#10b981" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {deadlines.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <Calendar size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No upcoming deadlines</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>All client filings are up to date</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.title}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Icon size={16} color={section.color} />
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                    {section.title}
                  </h2>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 99,
                      background: `${section.color}18`,
                      color: section.color,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {section.items.length}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {section.items.map((sub) => {
                    const ds = getDeadlineStatus(sub.dueDate!);
                    const catColor = categoryColor(sub.category.code ?? sub.category.name);
                    return (
                      <div
                        key={sub.id}
                        className="section-card"
                        style={{
                          padding: "12px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          borderLeft: `3px solid ${catColor}`,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {sub.title}
                            </p>
                          </div>
                          <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {sub.organization.businessProfile?.businessName ?? sub.organization.name}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {sub.category.name}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                            {format(sub.dueDate!, "dd MMM yyyy")}
                          </p>
                          <span
                            className="badge"
                            style={{
                              background: ds.bg,
                              color: ds.color,
                              borderColor: `${ds.color}30`,
                              display: "inline-block",
                              marginTop: 4,
                            }}
                          >
                            {ds.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
