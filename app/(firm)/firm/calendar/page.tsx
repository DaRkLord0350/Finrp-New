import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { CalendarFilter } from "@/components/firm/calendar/CalendarFilter";

interface CalEvent {
  id: string;
  title: string;
  date: Date;
  kind: "TASK" | "DEADLINE";
  completed: boolean;
  sub: string | null;
  href: string | null;
  color: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseMonth(raw: string | undefined): Date {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    if (!isNaN(d.getTime())) return d;
  }
  return startOfMonth(new Date());
}

export default async function FirmCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; caId?: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const monthDate = parseMonth(sp.month);
  const monthStr = format(monthDate, "yyyy-MM");
  const caId = sp.caId || "";

  const gridStart = startOfWeek(startOfMonth(monthDate));
  const gridEnd = endOfWeek(endOfMonth(monthDate));

  const [tasks, deadlines, caUsers] = await Promise.all([
    prisma.firmTask.findMany({
      where: {
        organizationId: user.organizationId,
        dueDate: { gte: gridStart, lte: gridEnd },
        ...(caId ? { assignedCaId: caId } : {}),
      },
      include: { customer: { select: { name: true } }, assignedCa: { select: { name: true } } },
    }),
    // Compliance deadlines are org-level (no per-CA) — shown only firm-wide.
    caId
      ? Promise.resolve([])
      : prisma.complianceDeadline.findMany({
          where: { organizationId: user.organizationId, deadlineDate: { gte: gridStart, lte: gridEnd } },
        }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] }, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const statusColor: Record<string, string> = {
    PENDING: "#f59e0b",
    IN_PROGRESS: "#3b82f6",
    WAITING_CLIENT: "#f97316",
    REVIEW: "#8b5cf6",
    COMPLETED: "#10b981",
  };

  const events: CalEvent[] = [
    ...tasks.map((t) => ({
      id: `t-${t.id}`,
      title: t.title,
      date: t.dueDate,
      kind: "TASK" as const,
      completed: t.status === "COMPLETED",
      sub: `${t.customer.name}${t.assignedCa.name ? ` · ${t.assignedCa.name}` : ""}`,
      href: `/firm/tasks/${t.id}`,
      color: statusColor[t.status] ?? "#6366f1",
    })),
    ...deadlines.map((d) => ({
      id: `d-${d.id}`,
      title: d.title,
      date: d.deadlineDate,
      kind: "DEADLINE" as const,
      completed: d.isCompleted,
      sub: "Compliance deadline",
      href: null,
      color: d.isCompleted ? "#10b981" : "#ec4899",
    })),
  ];

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const upcoming = events.filter((e) => !e.completed && e.date >= now && e.date <= in7).sort((a, b) => +a.date - +b.date);
  const overdue = events.filter((e) => !e.completed && e.date < now).sort((a, b) => +a.date - +b.date);
  const completedThisMonth = events.filter((e) => e.completed && isSameMonth(e.date, monthDate));

  const prevMonth = format(subMonths(monthDate, 1), "yyyy-MM");
  const nextMonth = format(addMonths(monthDate, 1), "yyyy-MM");
  const qp = (m: string) => `/firm/calendar?month=${m}${caId ? `&caId=${caId}` : ""}`;

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 className="section-title">Compliance Calendar</h1>
          <p className="section-subtitle">
            {caId ? caUsers.find((c) => c.id === caId)?.name ?? "CA" : "Firm-wide"} · tasks &amp; deadlines
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <CalendarFilter caUsers={caUsers} currentCaId={caId} month={monthStr} />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Link href={qp(prevMonth)} aria-label="Previous month" style={navBtn}><ChevronLeft size={16} /></Link>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", minWidth: 130, textAlign: "center" }}>
              {format(monthDate, "MMMM yyyy")}
            </span>
            <Link href={qp(nextMonth)} aria-label="Next month" style={navBtn}><ChevronRight size={16} /></Link>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Upcoming (7d)", value: upcoming.length, color: "#f59e0b", icon: Clock },
          { label: "Overdue", value: overdue.length, color: "#ef4444", icon: AlertTriangle },
          { label: "Completed (mo)", value: completedThisMonth.length, color: "#10b981", icon: CheckCircle2 },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="stat-card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><Icon size={16} color={s.color} /></div>
              <p style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Month grid */}
      <div className="section-card" style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid var(--border)" }}>
          {WEEKDAYS.map((w) => (
            <div key={w} style={{ padding: "10px 8px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {w}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {days.map((day, idx) => {
            const dayEvents = events.filter((e) => isSameDay(e.date, day));
            const inMonth = isSameMonth(day, monthDate);
            const today = isToday(day);
            return (
              <div
                key={idx}
                style={{
                  minHeight: 96,
                  padding: 6,
                  borderRight: (idx + 1) % 7 === 0 ? "none" : "1px solid var(--border)",
                  borderBottom: idx < days.length - 7 ? "1px solid var(--border)" : "none",
                  background: inMonth ? "transparent" : "var(--bg-elevated)",
                  opacity: inMonth ? 1 : 0.55,
                }}
              >
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: today ? 700 : 500,
                      color: today ? "white" : "var(--text-muted)",
                      background: today ? "#6366f1" : "transparent",
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {dayEvents.slice(0, 3).map((e) => {
                    const body = (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 5px",
                          borderRadius: 5,
                          background: `${e.color}1c`,
                          fontSize: 10.5,
                          color: e.color,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textDecoration: e.completed ? "line-through" : "none",
                        }}
                        title={`${e.title}${e.sub ? ` — ${e.sub}` : ""}`}
                      >
                        {e.title}
                      </div>
                    );
                    return e.href ? (
                      <Link key={e.id} href={e.href} style={{ textDecoration: "none" }}>{body}</Link>
                    ) : (
                      <div key={e.id}>{body}</div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <span style={{ fontSize: 10, color: "var(--text-muted)", paddingLeft: 4 }}>+{dayEvents.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lists */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px,1fr))", gap: 24 }}>
        <EventList title="Overdue" icon={<AlertTriangle size={15} color="#ef4444" />} events={overdue} empty="Nothing overdue." />
        <EventList title="Upcoming (7 days)" icon={<Clock size={15} color="#f59e0b" />} events={upcoming} empty="Nothing due this week." />
        <EventList title="Completed this month" icon={<CheckCircle2 size={15} color="#10b981" />} events={completedThisMonth} empty="None completed yet." />
      </div>
    </div>
  );
}

function EventList({ title, icon, events, empty }: { title: string; icon: React.ReactNode; events: CalEvent[]; empty: string }) {
  return (
    <div className="section-card">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        {icon}
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h2>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>{events.length}</span>
      </div>
      {events.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{empty}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {events.slice(0, 8).map((e) => {
            const row = (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</p>
                  {e.sub && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.sub}</p>}
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{format(e.date, "dd MMM")}</span>
              </div>
            );
            return e.href ? (
              <Link key={e.id} href={e.href} style={{ textDecoration: "none" }}>{row}</Link>
            ) : (
              <div key={e.id}>{row}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid var(--border)",
  color: "var(--text-secondary)",
  textDecoration: "none",
};
