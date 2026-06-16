"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  UserPlus,
  Upload,
  Download,
  UserCog,
  ShieldCheck,
  Pencil,
  Power,
  Mail,
  RefreshCw,
  Trash2,
  ChevronDown,
} from "lucide-react";
import {
  FIRM_ROLE_LABELS,
  FIRM_ROLE_COLORS,
  SPECIALIZATION_LABELS,
} from "@/lib/team/constants";
import type { FirmMemberRole, Specialization } from "@prisma/client";
import type { TeamMember, ActivityEntry } from "./types";
import { MemberFormModal } from "./MemberFormModal";
import { PermissionModal } from "./PermissionModal";
import { ImportModal } from "./ImportModal";
import { ActivityLog } from "./ActivityLog";

function roleColor(role: string | null): string {
  return role && role in FIRM_ROLE_COLORS ? FIRM_ROLE_COLORS[role as FirmMemberRole] : "#94a3b8";
}
function roleLabel(role: string | null): string {
  return role && role in FIRM_ROLE_LABELS ? FIRM_ROLE_LABELS[role as FirmMemberRole] : "—";
}
function specLabel(s: string | null): string | null {
  return s && s in SPECIALIZATION_LABELS ? SPECIALIZATION_LABELS[s as Specialization] : null;
}

type Tab = "members" | "invites" | "activity";

interface Props {
  initialMembers: TeamMember[];
  initialInvites: TeamMember[];
  initialActivity: ActivityEntry[];
}

export function TeamClient({ initialMembers, initialInvites, initialActivity }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [activity, setActivity] = useState(initialActivity);
  const [tab, setTab] = useState<Tab>("members");

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  const [permTarget, setPermTarget] = useState<TeamMember | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/api/firm/team");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMembers(data.members);
      setInvites(data.invites);
      setActivity(data.activity);
    } catch {
      toast.error("Failed to refresh team");
    }
  }

  async function toggleActive(m: TeamMember) {
    const next = !m.isActive;
    if (!next && !confirm(`Deactivate ${m.name ?? m.email}? They will lose portal access.`)) return;
    try {
      const res = await fetch(`/api/firm/team/${m.id}/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(next ? "Member reactivated" : "Member deactivated");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  async function resendInvite(inv: TeamMember) {
    try {
      const res = await fetch(`/api/firm/team/invite/${inv.id}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(`Invite resent to ${inv.email}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to resend invite");
    }
  }

  async function revokeInvite(inv: TeamMember) {
    if (!confirm(`Revoke the invite for ${inv.email}?`)) return;
    try {
      const res = await fetch(`/api/firm/team/invite/${inv.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success("Invite revoked");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke invite");
    }
  }

  function exportRoster(format: "xlsx" | "csv") {
    setExportOpen(false);
    window.location.href = `/api/firm/team/export?format=${format}`;
  }

  const caCount = members.filter((m) => m.firmRole === "CA").length;
  const totalAssignments = members.reduce((a, m) => a + m.customerCount, 0);

  const stats = [
    { label: "Team Members", value: members.length, color: "#6366f1" },
    { label: "CA Members", value: caCount, color: "#0ea5e9" },
    { label: "Active Assignments", value: totalAssignments, color: "#10b981" },
    { label: "Pending Invites", value: invites.filter((i) => i.status === "PENDING").length, color: "#f59e0b" },
  ];

  return (
    <div className="page-container animate-fade-in">
      {/* Header + toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 className="section-title">Team</h1>
          <p className="section-subtitle">
            {members.length} member{members.length !== 1 ? "s" : ""}
            {invites.filter((i) => i.status === "PENDING").length > 0 &&
              ` · ${invites.filter((i) => i.status === "PENDING").length} pending`}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setExportOpen((v) => !v)} style={toolbarBtn(false)}>
              <Download size={14} /> Export <ChevronDown size={13} />
            </button>
            {exportOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 40,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 6,
                  zIndex: 30,
                  minWidth: 150,
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                {(["xlsx", "csv"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => exportRoster(f)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      background: "transparent",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "var(--text-secondary)",
                      fontSize: 13,
                    }}
                  >
                    {f === "xlsx" ? "Excel (.xlsx)" : "CSV (.csv)"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setImportOpen(true)} style={toolbarBtn(false)}>
            <Upload size={14} /> Import
          </button>
          <button onClick={() => setAddOpen(true)} style={toolbarBtn(true)}>
            <UserPlus size={14} /> Add Member
          </button>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {([
          ["members", `Members (${members.length})`],
          ["invites", `Pending Invites (${invites.length})`],
          ["activity", "Activity Log"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "10px 14px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${tab === key ? "#6366f1" : "transparent"}`,
              color: tab === key ? "var(--text-primary)" : "var(--text-muted)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Members */}
      {tab === "members" && (
        members.length === 0 ? (
          <EmptyState
            icon={<UserCog size={46} color="var(--text-muted)" />}
            title="No team members yet"
            body="Add your first team member — they'll get an invite to join the firm."
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
            {members.map((m) => (
              <MemberCard
                key={m.id}
                m={m}
                onEdit={() => setEditTarget(m)}
                onPerms={() => setPermTarget(m)}
                onToggle={() => toggleActive(m)}
              />
            ))}
          </div>
        )
      )}

      {/* Invites */}
      {tab === "invites" && (
        invites.length === 0 ? (
          <EmptyState
            icon={<Mail size={46} color="var(--text-muted)" />}
            title="No pending invites"
            body="Invites you send appear here until the member signs up."
          />
        ) : (
          <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
            {invites.map((inv, i) => (
              <div
                key={inv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: `${roleColor(inv.firmRole)}20`,
                    color: roleColor(inv.firmRole),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {(inv.name ?? inv.email).charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{inv.name ?? inv.email}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {inv.email} · {roleLabel(inv.firmRole)}
                    {inv.expiresAt && ` · expires ${new Date(inv.expiresAt).toLocaleDateString("en-IN")}`}
                  </p>
                </div>
                <span
                  className="badge"
                  style={{
                    background: inv.status === "EXPIRED" ? "#ef444418" : "#f59e0b18",
                    color: inv.status === "EXPIRED" ? "#ef4444" : "#f59e0b",
                    borderColor: inv.status === "EXPIRED" ? "#ef444430" : "#f59e0b30",
                  }}
                >
                  {inv.status === "EXPIRED" ? "Expired" : "Pending"}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <IconBtn title="Edit" onClick={() => setEditTarget(inv)}>
                    <Pencil size={14} />
                  </IconBtn>
                  <IconBtn title="Resend" onClick={() => resendInvite(inv)}>
                    <RefreshCw size={14} />
                  </IconBtn>
                  <IconBtn title="Revoke" danger onClick={() => revokeInvite(inv)}>
                    <Trash2 size={14} />
                  </IconBtn>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Activity */}
      {tab === "activity" && <ActivityLog activity={activity} />}

      {/* Modals */}
      {addOpen && (
        <MemberFormModal mode="add" onClose={() => setAddOpen(false)} onSaved={refresh} />
      )}
      {editTarget && (
        <MemberFormModal mode="edit" member={editTarget} onClose={() => setEditTarget(null)} onSaved={refresh} />
      )}
      {permTarget && (
        <PermissionModal member={permTarget} onClose={() => setPermTarget(null)} onSaved={refresh} />
      )}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImported={refresh} />}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function MemberCard({
  m,
  onEdit,
  onPerms,
  onToggle,
}: {
  m: TeamMember;
  onEdit: () => void;
  onPerms: () => void;
  onToggle: () => void;
}) {
  const color = roleColor(m.firmRole);
  const spec = specLabel(m.specialization);
  return (
    <div className="section-card" style={{ opacity: m.isActive ? 1 : 0.65 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: `${color}20`,
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {(m.name ?? m.email).charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {m.name ?? "—"}
          </p>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {m.email}
          </p>
        </div>
        <span
          className="badge"
          style={{ background: `${color}18`, color, borderColor: `${color}30`, flexShrink: 0 }}
        >
          {roleLabel(m.firmRole)}
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, minHeight: 22 }}>
        {spec && (
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 6,
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
            }}
          >
            {spec}
          </span>
        )}
        {m.phone && (
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
            {m.phone}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <Metric value={m.customerCount} label="Customers" color="#0ea5e9" />
        <Metric value={m.openTaskCount} label="Open Tasks" color="#f59e0b" />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.isActive ? "#10b981" : "#ef4444", flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {m.isActive ? "Active" : "Inactive"}
          {m.joiningDate && ` · joined ${new Date(m.joiningDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`}
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <CardAction icon={<Pencil size={13} />} label="Edit" onClick={onEdit} />
        <CardAction icon={<ShieldCheck size={13} />} label="Permissions" onClick={onPerms} />
        <CardAction
          icon={<Power size={13} />}
          label={m.isActive ? "Deactivate" : "Activate"}
          onClick={onToggle}
          danger={m.isActive}
        />
      </div>
    </div>
  );
}

function Metric({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 8, textAlign: "center" }}>
      <p style={{ fontSize: 20, fontWeight: 700, color }}>{value}</p>
      <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{label}</p>
    </div>
  );
}

function CardAction({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        padding: "7px 4px",
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 7,
        cursor: "pointer",
        fontSize: 11.5,
        fontWeight: 600,
        color: danger ? "#ef4444" : "var(--text-secondary)",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 30,
        height: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 7,
        cursor: "pointer",
        color: danger ? "#ef4444" : "var(--text-secondary)",
      }}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="section-card">
      <div className="empty-state">
        {icon}
        <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{title}</p>
        <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 320, textAlign: "center" }}>{body}</p>
      </div>
    </div>
  );
}

function toolbarBtn(primary: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 14px",
    background: primary ? "#6366f1" : "var(--bg-elevated)",
    color: primary ? "white" : "var(--text-secondary)",
    border: primary ? "none" : "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };
}
