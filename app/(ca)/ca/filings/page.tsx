import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format, isToday, isThisWeek } from "date-fns";
import { ClipboardList, AlertTriangle, Clock, CalendarDays } from "lucide-react";

async function getFilingQueue(caUserId: string) {
  const orgIds = await prisma.cAClient.findMany({
    where: { caUserId, isActive: true },
    select: { organizationId: true },
  }).then((r) => r.map((c) => c.organizationId));

  if (orgIds.length === 0) return { readyToFile: [], dueToday: [], dueThisWeek: [], overdue: [] };

  const allPending = await prisma.complianceSubmission.findMany({
    where: {
      organizationId: { in: orgIds },
      deletedAt: null,
      status: { notIn: ["APPROVED", "COMPLETED"] },
    },
    include: {
      organization: { include: { businessProfile: true } },
      category: { select: { name: true, code: true } },
      documents: { select: { reviewStatus: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));
  const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const readyToFile = allPending.filter(
    (s) => s.status === "UNDER_REVIEW" && s.documents.every((d) => d.reviewStatus === "APPROVED")
  );
  const dueToday = allPending.filter(
    (s) => s.dueDate && s.dueDate >= startOfDay && s.dueDate <= endOfDay
  );
  const dueThisWeek = allPending.filter(
    (s) => s.dueDate && s.dueDate > endOfDay && s.dueDate <= inAWeek
  );
  const overdue = allPending.filter(
    (s) => s.dueDate && s.dueDate < startOfDay
  );

  return { readyToFile, dueToday, dueThisWeek, overdue };
}

function statusColor(status: string) {
  const m: Record<string, string> = {
    DRAFT: "#94a3b8", SUBMITTED: "#3b82f6", UNDER_REVIEW: "#f59e0b",
    APPROVED: "#10b981", COMPLETED: "#10b981", REJECTED: "#ef4444",
  };
  return m[status] ?? "#94a3b8";
}

function FilingCard({ sub }: { sub: Awaited<ReturnType<typeof getFilingQueue>>["readyToFile"][0] }) {
  const docsApproved = sub.documents.filter((d) => d.reviewStatus === "APPROVED").length;
  return (
    <div
      className="section-card"
      style={{
        padding: "14px 16px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(sub.status), flexShrink: 0 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sub.title}
          </p>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {sub.organization.businessProfile?.businessName ?? sub.organization.name}
          {" · "}{sub.category.name}
        </p>
        {sub.documents.length > 0 && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {docsApproved}/{sub.documents.length} docs approved
          </p>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {sub.dueDate && (
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
            {format(sub.dueDate, "dd MMM")}
          </p>
        )}
        <span
          className="badge"
          style={{
            background: `${statusColor(sub.status)}18`,
            color: statusColor(sub.status),
            borderColor: `${statusColor(sub.status)}30`,
            marginTop: 4,
            display: "inline-block",
          }}
        >
          {sub.status.replace("_", " ")}
        </span>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  color,
  items,
  emptyText,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  items: Awaited<ReturnType<typeof getFilingQueue>>["readyToFile"];
  emptyText: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon size={16} color={color} />
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h2>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 99,
            background: `${color}18`,
            color,
            fontSize: 11,
            fontWeight: 600,
            marginLeft: 4,
          }}
        >
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div
          style={{
            padding: "20px",
            borderRadius: 10,
            background: "var(--bg-surface)",
            border: "1px dashed var(--border)",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          {emptyText}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((s) => (
            <FilingCard key={s.id} sub={s} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function CAFilingsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const { readyToFile, dueToday, dueThisWeek, overdue } = await getFilingQueue(user.id);
  const total = readyToFile.length + dueToday.length + dueThisWeek.length + overdue.length;

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Filing Queue</h1>
        <p className="section-subtitle">{total} pending filing{total !== 1 ? "s" : ""} across all clients</p>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Ready To File", value: readyToFile.length, color: "#6366f1" },
          { label: "Due Today", value: dueToday.length, color: "#ef4444" },
          { label: "Due This Week", value: dueThisWeek.length, color: "#f97316" },
          { label: "Overdue", value: overdue.length, color: "#dc2626" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Board */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
        <Section
          title="Ready To File"
          icon={ClipboardList}
          color="#6366f1"
          items={readyToFile}
          emptyText="No filings ready yet"
        />
        <Section
          title="Due Today"
          icon={Clock}
          color="#ef4444"
          items={dueToday}
          emptyText="Nothing due today"
        />
        <Section
          title="Due This Week"
          icon={CalendarDays}
          color="#f97316"
          items={dueThisWeek}
          emptyText="Nothing due this week"
        />
        <Section
          title="Overdue"
          icon={AlertTriangle}
          color="#dc2626"
          items={overdue}
          emptyText="No overdue filings"
        />
      </div>
    </div>
  );
}
