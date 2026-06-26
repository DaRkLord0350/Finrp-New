// ============================================================
// CA Portal — Client Profile (6 tabs)
// Overview · Documents · Compliance · Tasks · Accounting · Communication
// Scoped to a customer the CA is actively assigned to.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  ShieldCheck,
  ClipboardList,
  Calculator,
  MessagesSquare,
  LayoutGrid,
  Mail,
  Phone,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import { isCustomerAssignedTo, resolveCustomerOrgId } from "@/lib/ca/portal";
import { computeOnboardingStages } from "@/lib/ca/onboarding";
import { ensureChecklist, reconcileChecklistStatuses, CHECKLIST_STATUS_META } from "@/lib/ca/checklist";
import OpenWorkspaceButton from "@/components/workspace/OpenWorkspaceButton";
import ResendInviteButton from "@/components/ca/ResendInviteButton";
import type { CustomerInvitation } from "@prisma/client";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "compliance", label: "Compliance", icon: ShieldCheck },
  { key: "tasks", label: "Tasks", icon: ClipboardList },
  { key: "accounting", label: "Accounting", icon: Calculator },
  { key: "communication", label: "Communication", icon: MessagesSquare },
] as const;

const COMPLIANCE_COLOR: Record<string, string> = {
  GST: "#6366f1", TDS: "#0ea5e9", ROC: "#f59e0b", ITR: "#10b981", PF: "#8b5cf6", ESI: "#ec4899",
};
const CAL_STATUS_COLOR: Record<string, string> = {
  UPCOMING: "#0ea5e9", DUE: "#f59e0b", OVERDUE: "#ef4444", COMPLETED: "#10b981",
};
const TASK_STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b", IN_PROGRESS: "#3b82f6", WAITING_CLIENT: "#f97316", REVIEW: "#8b5cf6", COMPLETED: "#10b981",
};

export default async function ClientProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const { customerId } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = (TABS.find((t) => t.key === tabParam)?.key ?? "overview") as (typeof TABS)[number]["key"];

  // Scope guard — must be actively assigned (ADMIN bypasses).
  const allowed = user.userRole === "ADMIN" || (await isCustomerAssignedTo(user.id, customerId));
  if (!allowed) notFound();

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) notFound();

  const orgId = await resolveCustomerOrgId(customerId);
  const onboarding = await computeOnboardingStages(customerId, customer.organizationId);
  const invitation = await prisma.customerInvitation.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });

  const health = onboarding.ready ? "#10b981" : "#f59e0b";

  return (
    <div className="page-container animate-fade-in">
      {/* Back */}
      <Link
        href="/ca/clients"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", textDecoration: "none", marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> My Clients
      </Link>

      {/* Header */}
      <div className="section-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 14, flexShrink: 0,
              background: "linear-gradient(135deg,#6366f1,#0ea5e9)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Building2 size={26} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{customer.name}</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              {customer.company ?? customer.customerType}
              {customer.gstin ? ` · GSTIN ${customer.gstin}` : ""}
            </p>
            <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
              {customer.email && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                  <Mail size={12} /> {customer.email}
                </span>
              )}
              {customer.phone && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                  <Phone size={12} /> {customer.phone}
                </span>
              )}
              {(customer.city || customer.state) && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                  <MapPin size={12} /> {[customer.city, customer.state].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right", minWidth: 160 }}>
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Onboarding</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <div style={{ flex: 1, height: 7, borderRadius: 99, background: "var(--bg-overlay)", overflow: "hidden", minWidth: 90 }}>
                  <div style={{ height: "100%", width: `${onboarding.progress}%`, background: health, borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: health }}>{onboarding.progress}%</span>
              </div>
            </div>
            {orgId ? (
              <OpenWorkspaceButton organizationId={orgId} compact />
            ) : invitation?.status === "ACCEPTED" ? (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Not onboarded yet</span>
            ) : (
              <ResendInviteButton customerId={customerId} hasInvitation={Boolean(invitation)} />
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <Link
              key={t.key}
              href={`/ca/clients/${customerId}?tab=${t.key}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px",
                fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap",
                color: active ? "#818cf8" : "var(--text-secondary)",
                borderBottom: `2px solid ${active ? "#6366f1" : "transparent"}`,
                marginBottom: -1,
              }}
            >
              <Icon size={14} /> {t.label}
            </Link>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <OverviewTab customerId={customerId} onboarding={onboarding} customer={customer} invitation={invitation} />
      )}
      {tab === "documents" && <DocumentsTab customerId={customerId} organizationId={customer.organizationId} />}
      {tab === "compliance" && <ComplianceTab customerId={customerId} />}
      {tab === "tasks" && <TasksTab customerId={customerId} caUserId={user.id} />}
      {tab === "accounting" && <AccountingTab orgId={orgId} />}
      {tab === "communication" && <CommunicationTab customerId={customerId} />}
    </div>
  );
}

// ── Invite status (delivery + CA/Admin debugging) ──────────────
function InviteStatusCard({
  customerId,
  invitation,
}: {
  customerId: string;
  invitation: CustomerInvitation | null;
}) {
  if (!invitation) {
    return (
      <div className="section-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Invitation Status</h3>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
          No invitation has ever been sent to this client — they were added directly as a client record. Use{" "}
          <strong>Send Invitation</strong> above to onboard them.
        </p>
      </div>
    );
  }

  const sent = Boolean(invitation.sentAt);
  const opened = Boolean(invitation.emailOpenedAt);
  const accepted = invitation.status === "ACCEPTED";
  const failed = Boolean(invitation.emailError) && !sent;
  const expired = !accepted && invitation.expiresAt < new Date();

  const rows: { label: string; done: boolean; warn?: boolean }[] = [
    { label: "Sent", done: sent },
    { label: "Delivered", done: sent }, // Resend "accepted" — no delivered webhook configured
    { label: "Opened", done: opened },
    { label: "Accepted", done: accepted },
    { label: "Failed", done: failed, warn: failed },
  ];

  return (
    <div className="section-card">
      <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Invitation Status</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {r.warn ? (
              <AlertTriangle size={14} color="#ef4444" />
            ) : r.done ? (
              <CheckCircle2 size={14} color="#10b981" />
            ) : (
              <Circle size={14} color="var(--border)" />
            )}
            <span style={{ fontSize: 12.5, color: r.warn ? "#ef4444" : r.done ? "var(--text-primary)" : "var(--text-muted)" }}>
              {r.label}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5, color: "var(--text-secondary)", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <Row label="Sent At" value={invitation.sentAt ? format(invitation.sentAt, "dd MMM yyyy, HH:mm") : "—"} />
        <Row label="Last Opened" value={invitation.emailOpenedAt ? format(invitation.emailOpenedAt, "dd MMM yyyy, HH:mm") : "—"} />
        <Row
          label="Expires At"
          value={format(invitation.expiresAt, "dd MMM yyyy")}
          valueColor={expired ? "#ef4444" : undefined}
        />
        <Row label="Resends" value={String(invitation.resendCount)} />
      </div>

      {/* CA/Admin-only debugging — this page is already gated to CA/CA_FIRM_ADMIN/ADMIN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5, marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
          Debug (CA/Admin)
        </p>
        <Row label="Email Sent" value={sent ? "Yes" : "No"} valueColor={sent ? "#10b981" : "#ef4444"} />
        <Row label="Message ID" value={invitation.emailMessageId ?? "—"} mono />
        <Row label="Last Error" value={invitation.emailError ?? "—"} valueColor={invitation.emailError ? "#ef4444" : undefined} />
        <a
          href={`/api/debug/customer-invite/${customerId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: "#818cf8", textDecoration: "none", marginTop: 4 }}
        >
          View raw debug payload →
        </a>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor, mono }: { label: string; value: string; valueColor?: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span
        style={{
          color: valueColor ?? "var(--text-secondary)",
          fontFamily: mono ? "monospace" : undefined,
          fontSize: mono ? 11 : undefined,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 160,
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────
async function OverviewTab({
  customerId,
  onboarding,
  customer,
  invitation,
}: {
  customerId: string;
  onboarding: Awaited<ReturnType<typeof computeOnboardingStages>>;
  customer: { notes: string | null; createdAt: Date };
  invitation: CustomerInvitation | null;
}) {
  const [taskAgg, compAgg, checklist] = await Promise.all([
    prisma.firmTask.groupBy({ by: ["status"], where: { customerId }, _count: true }),
    prisma.complianceCalendarEntry.groupBy({ by: ["status"], where: { customerId }, _count: true }),
    prisma.clientChecklist.findUnique({ where: { customerId }, include: { items: { select: { status: true } } } }),
  ]);

  const openTasks = taskAgg.filter((t) => t.status !== "COMPLETED").reduce((a, t) => a + t._count, 0);
  const overdueComp = compAgg.find((c) => c.status === "OVERDUE")?._count ?? 0;
  const docsDone = checklist?.items.filter((i) => i.status === "UPLOADED").length ?? 0;
  const docsTotal = checklist?.items.length ?? 0;

  const summary = [
    { label: "Open Tasks", value: openTasks, color: "#f59e0b" },
    { label: "Compliance Overdue", value: overdueComp, color: "#ef4444" },
    { label: "Documents", value: `${docsDone}/${docsTotal}`, color: "#10b981" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
      {/* Onboarding tracker */}
      <div className="section-card">
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 18 }}>Onboarding Tracker</h2>
        <div style={{ position: "relative" }}>
          {onboarding.stages.map((s, i) => {
            const done = s.status === "COMPLETED";
            const active = s.status === "IN_PROGRESS";
            const color = done ? "#10b981" : active ? "#0ea5e9" : "var(--text-muted)";
            return (
              <div key={s.stage} style={{ display: "flex", gap: 14, paddingBottom: i === onboarding.stages.length - 1 ? 0 : 20, position: "relative" }}>
                {i < onboarding.stages.length - 1 && (
                  <div style={{ position: "absolute", left: 11, top: 24, bottom: 0, width: 2, background: done ? "#10b981" : "var(--border)" }} />
                )}
                <div style={{ zIndex: 1, flexShrink: 0 }}>
                  {done ? <CheckCircle2 size={24} color="#10b981" /> : active ? <Clock size={24} color="#0ea5e9" /> : <Circle size={24} color="var(--border)" />}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: done || active ? "var(--text-primary)" : "var(--text-muted)" }}>{s.label}</p>
                  <p style={{ fontSize: 11, color }}>
                    {done && s.completedAt ? `Completed ${format(s.completedAt, "dd MMM yyyy")}` : active ? "In progress" : "Pending"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side summary */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <InviteStatusCard customerId={customerId} invitation={invitation} />
        <div className="section-card">
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>At a Glance</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {summary.map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{s.label}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="section-card">
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>Notes</h3>
          <p style={{ fontSize: 12.5, color: customer.notes ? "var(--text-secondary)" : "var(--text-muted)", lineHeight: 1.6 }}>
            {customer.notes ?? "No notes for this client yet."}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
            Client since {format(customer.createdAt, "dd MMM yyyy")}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Documents (checklist) ─────────────────────────────────────
async function DocumentsTab({ customerId, organizationId }: { customerId: string; organizationId: string }) {
  await ensureChecklist(customerId, organizationId);
  await reconcileChecklistStatuses(customerId);
  const checklist = await prisma.clientChecklist.findUnique({
    where: { customerId },
    include: { items: { orderBy: { sortOrder: "asc" }, include: { customerDocument: { select: { fileName: true, fileUrl: true, createdAt: true } } } } },
  });
  const items = checklist?.items ?? [];

  return (
    <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Document</th>
            <th>Status</th>
            <th>File</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const meta = CHECKLIST_STATUS_META[it.status];
            return (
              <tr key={it.id}>
                <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{it.label}</td>
                <td>
                  <span className="badge" style={{ background: `${meta.color}1a`, color: meta.color, borderColor: `${meta.color}30` }}>
                    {meta.label}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {it.customerDocument ? (
                    <a href={it.customerDocument.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#818cf8", textDecoration: "none" }}>
                      {it.customerDocument.fileName}
                    </a>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: it.expiresAt && it.expiresAt < new Date() ? "#ef4444" : "var(--text-muted)" }}>
                  {it.expiresAt ? format(it.expiresAt, "dd MMM yyyy") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Compliance ────────────────────────────────────────────────
async function ComplianceTab({ customerId }: { customerId: string }) {
  const entries = await prisma.complianceCalendarEntry.findMany({
    where: { customerId },
    orderBy: { dueDate: "asc" },
  });

  if (entries.length === 0) {
    return (
      <div className="section-card">
        <div className="empty-state">
          <ShieldCheck size={40} color="var(--text-muted)" />
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No compliance items scheduled for this client.</p>
          <Link href="/ca/compliance" className="badge" style={{ marginTop: 8, textDecoration: "none" }}>Go to Compliance Center</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="data-table">
        <thead>
          <tr><th>Type</th><th>Filing</th><th>Period</th><th>Due</th><th>Status</th></tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>
                <span className="badge" style={{ background: `${COMPLIANCE_COLOR[e.type]}1a`, color: COMPLIANCE_COLOR[e.type], borderColor: `${COMPLIANCE_COLOR[e.type]}30` }}>
                  {e.type}
                </span>
              </td>
              <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{e.title}</td>
              <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{e.period ?? "—"}</td>
              <td style={{ fontSize: 12, color: e.status === "OVERDUE" ? "#ef4444" : "var(--text-secondary)" }}>{format(e.dueDate, "dd MMM yyyy")}</td>
              <td>
                <span className="badge" style={{ background: `${CAL_STATUS_COLOR[e.status]}1a`, color: CAL_STATUS_COLOR[e.status], borderColor: `${CAL_STATUS_COLOR[e.status]}30` }}>
                  {e.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tasks ─────────────────────────────────────────────────────
async function TasksTab({ customerId }: { customerId: string; caUserId: string }) {
  const tasks = await prisma.firmTask.findMany({
    where: { customerId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  if (tasks.length === 0) {
    return (
      <div className="section-card">
        <div className="empty-state">
          <ClipboardList size={40} color="var(--text-muted)" />
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No tasks for this client.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {tasks.map((t) => (
        <div key={t.id} className="section-card" style={{ padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{t.title}</p>
              {t.description && <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>{t.description}</p>}
              <p style={{ fontSize: 11.5, color: t.dueDate < new Date() && t.status !== "COMPLETED" ? "#ef4444" : "var(--text-muted)", marginTop: 4 }}>
                Due {format(t.dueDate, "dd MMM yyyy")}
              </p>
            </div>
            <span className="badge" style={{ background: `${TASK_STATUS_COLOR[t.status]}1a`, color: TASK_STATUS_COLOR[t.status], borderColor: `${TASK_STATUS_COLOR[t.status]}30`, flexShrink: 0 }}>
              {t.status.replace("_", " ")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Accounting (via bridged org) ──────────────────────────────
async function AccountingTab({ orgId }: { orgId: string | null }) {
  if (!orgId) {
    return (
      <div className="section-card">
        <div className="empty-state">
          <Calculator size={40} color="var(--text-muted)" />
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Workspace not connected</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 320, textAlign: "center" }}>
            Accounting data appears once this client completes onboarding and connects their FinRP workspace.
          </p>
        </div>
      </div>
    );
  }

  const [invoiceAgg, bankAccounts, journalCount, expenseAgg] = await Promise.all([
    prisma.invoice.aggregate({ where: { organizationId: orgId }, _count: true, _sum: { total: true } }),
    prisma.bankAccount.count({ where: { organizationId: orgId } }),
    prisma.journalEntry.count({ where: { organizationId: orgId } }),
    prisma.expense.aggregate({ where: { organizationId: orgId }, _count: true, _sum: { amount: true } }),
  ]);

  const cards = [
    { label: "Invoices", value: invoiceAgg._count, sub: `₹${Number(invoiceAgg._sum.total ?? 0).toLocaleString("en-IN")}`, color: "#6366f1" },
    { label: "Bank Accounts", value: bankAccounts, sub: "linked", color: "#0ea5e9" },
    { label: "Journal Entries", value: journalCount, sub: "posted + draft", color: "#f59e0b" },
    { label: "Expenses", value: expenseAgg._count, sub: `₹${Number(expenseAgg._sum.amount ?? 0).toLocaleString("en-IN")}`, color: "#ef4444" },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 16, marginBottom: 16 }}>
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <p style={{ fontSize: 26, fontWeight: 700, color: c.color }}>{c.value}</p>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>{c.label}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.sub}</p>
          </div>
        ))}
      </div>
      <div className="section-card">
        <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          Open the client workspace to view and manage their full accounting — invoices, ledgers, banking and reconciliation — on their behalf.
        </p>
      </div>
    </div>
  );
}

// ── Communication ─────────────────────────────────────────────
async function CommunicationTab({ customerId }: { customerId: string }) {
  const conversations = await prisma.conversation.findMany({
    where: { customerId },
    orderBy: { lastMessageAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, createdAt: true } },
      _count: { select: { messages: true } },
    },
  });

  if (conversations.length === 0) {
    return (
      <div className="section-card">
        <div className="empty-state">
          <MessagesSquare size={40} color="var(--text-muted)" />
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No conversations with this client yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {conversations.map((c) => (
        <div key={c.id} className="section-card" style={{ padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{c.subject ?? "Conversation"}</p>
              {c.messages[0] && (
                <p style={{ fontSize: 12.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                  {c.messages[0].content}
                </p>
              )}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <span className="badge">{c._count.messages} msg</span>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {formatDistanceToNow(c.lastMessageAt, { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
