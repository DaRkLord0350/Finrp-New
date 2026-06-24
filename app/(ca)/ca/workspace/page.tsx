// ============================================================
// CA Portal — Workspace
// CA productivity hub backed by real data: e-sign requests,
// compliance templates, AI assistant threads and per-client notes.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { PenLine, LayoutTemplate, Bot, StickyNote, ArrowUpRight } from "lucide-react";
import WorkspaceNotes, { type NoteRow } from "./WorkspaceNotes";

const SIG_COLOR: Record<string, string> = {
  PENDING: "#94a3b8", SENT: "#3b82f6", VIEWED: "#0ea5e9", SIGNED: "#10b981",
  REJECTED: "#ef4444", EXPIRED: "#f97316", CANCELLED: "#64748b",
};

export default async function WorkspacePage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const [assignments, signatures, templates, threads] = await Promise.all([
    prisma.customerAssignment.findMany({
      where: { caId: user.id, isActive: true },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.signatureRequest.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.complianceTemplate.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { _count: { select: { tasks: true } } },
    }),
    prisma.caCopilotThread.findMany({
      where: { caUserId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ]);

  const notes: NoteRow[] = assignments.map((a) => ({ customerId: a.customer.id, name: a.customer.name, notes: a.notes ?? "" }));

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">Workspace</h1>
        <p className="section-subtitle">Your tools — e-signatures, templates, AI assistant and client notes.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* E-sign */}
        <div className="section-card">
          <SectionHead icon={PenLine} color="#6366f1" title="E-Signatures" />
          {signatures.length === 0 ? (
            <Empty text="No signature requests yet." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {signatures.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.signerName ?? s.signerEmail}</p>
                  </div>
                  <span className="badge" style={{ background: `${SIG_COLOR[s.status]}1a`, color: SIG_COLOR[s.status], borderColor: `${SIG_COLOR[s.status]}30` }}>{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Templates */}
        <div className="section-card">
          <SectionHead icon={LayoutTemplate} color="#0ea5e9" title="Compliance Templates" />
          {templates.length === 0 ? (
            <Empty text="No templates configured." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {templates.map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.frequency} · {t._count.tasks} task{t._count.tasks !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI assistant */}
      <div className="section-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <SectionHead icon={Bot} color="#8b5cf6" title="AI Assistant" inline />
          <Link href="/ca-hub/copilot" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "#a78bfa", textDecoration: "none" }}>
            Open Copilot <ArrowUpRight size={13} />
          </Link>
        </div>
        {threads.length === 0 ? (
          <Empty text="Ask the AI assistant about GST, TDS, ITR, ROC and more — your recent threads will show here." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
            {threads.map((th) => (
              <Link key={th.id} href="/ca-hub/copilot" style={{ textDecoration: "none" }}>
                <div style={{ padding: "12px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{th.title}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{th.domain} · {formatDistanceToNow(th.updatedAt, { addSuffix: true })}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="section-card">
        <SectionHead icon={StickyNote} color="#f59e0b" title="Client Notes" />
        <WorkspaceNotes rows={notes} />
      </div>
    </div>
  );
}

function SectionHead({ icon: Icon, color, title, inline }: { icon: typeof PenLine; color: string; title: string; inline?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: inline ? 0 : 14 }}>
      <Icon size={16} color={color} />
      <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h2>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "12px 0" }}>{text}</p>;
}
