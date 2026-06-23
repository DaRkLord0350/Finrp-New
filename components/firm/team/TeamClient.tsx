"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  UserPlus,
  Upload,
  Download,
  UserCog,
  Pencil,
  Power,
  Mail,
  RefreshCw,
  Trash2,
  ChevronDown,
  Search,
  Eye,
  X,
  History,
} from "lucide-react";
import {
  FIRM_ROLE_LABELS,
  FIRM_ROLE_COLORS,
  FIRM_MEMBER_ROLES,
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

type Tab = "members" | "invites" | "activity" | "imports";

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

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  const [permTarget, setPermTarget] = useState<TeamMember | null>(null);
  const [viewTarget, setViewTarget] = useState<TeamMember | null>(null);
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

  function exportRoster(fmt: "xlsx" | "csv") {
    setExportOpen(false);
    window.location.href = `/api/firm/team/export?format=${fmt}`;
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "ALL" && m.firmRole !== roleFilter) return false;
      if (statusFilter === "ACTIVE" && !m.isActive) return false;
      if (statusFilter === "INACTIVE" && m.isActive) return false;
      if (q) {
        const hay = `${m.name ?? ""} ${m.email} ${m.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [members, search, roleFilter, statusFilter]);

  const importHistory = useMemo(
    () => activity.filter((a) => a.action === "MEMBERS_IMPORTED"),
    [activity]
  );

  const pendingCount = invites.filter((i) => i.status === "PENDING" || i.status === "SENT").length;
  const caCount = members.filter((m) => m.firmRole === "CA").length;
  const totalAssignments = members.reduce((a, m) => a + m.customerCount, 0);

  const stats = [
    { label: "Team Members", value: members.length, color: "#6366f1" },
    { label: "CA Members", value: caCount, color: "#0ea5e9" },
    { label: "Active Assignments", value: totalAssignments, color: "#10b981" },
    { label: "Pending Invites", value: pendingCount, color: "#f59e0b" },
  ];

  return (
    <div className="page-container animate-fade-in">
      {/* Header + toolbar */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 className="section-title">Team</h1>
          <p className="section-subtitle">
            {members.length} member{members.length !== 1 ? "s" : ""}
            {pendingCount > 0 && ` · ${pendingCount} pending`}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setExportOpen((v) => !v)} style={toolbarBtn(false)}>
              <Download size={14} /> Export <ChevronDown size={13} />
            </button>
            {exportOpen && (
              <div style={{ position: "absolute", right: 0, top: 40, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: 6, zIndex: 30, minWidth: 150, boxShadow: "var(--shadow-lg)" }}>
                {(["xlsx", "csv"] as const).map((f) => (
                  <button key={f} onClick={() => exportRoster(f)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "transparent", border: "none", borderRadius: 6, cursor: "pointer", color: "var(--text-secondary)", fontSize: 13 }}>
                    {f === "xlsx" ? "Excel (.xlsx)" : "CSV (.csv)"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setImportOpen(true)} style={toolbarBtn(false)}>
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={() => setAddOpen(true)} style={toolbarBtn(true)}>
            <UserPlus size={14} /> Add Team Member
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <p style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 20, flexWrap: "wrap" }}>
        {([
          ["members", `Members (${members.length})`],
          ["invites", `Pending Invites (${pendingCount})`],
          ["activity", "Activity Log"],
          ["imports", `Import History (${importHistory.length})`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{ padding: "10px 14px", background: "transparent", border: "none", borderBottom: `2px solid ${tab === key ? "#6366f1" : "transparent"}`, color: tab === key ? "var(--text-primary)" : "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: -1 }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Members directory */}
      {tab === "members" && (
        <>
          {/* Filter bar */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
              <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email or phone…"
                style={{ width: "100%", padding: "9px 12px 9px 36px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13 }}
              />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={selectStyle}>
              <option value="ALL">All roles</option>
              {FIRM_MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>{FIRM_ROLE_LABELS[r]}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<UserCog size={46} color="var(--text-muted)" />}
              title={members.length === 0 ? "No team members yet" : "No members match your filters"}
              body={members.length === 0 ? "Add your first team member — they'll get an invite to join the firm." : "Try clearing the search or filters."}
            />
          ) : (
            <div className="section-card" style={{ padding: 0, overflow: "auto" }}>
              <table className="data-table" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={{ width: 48 }}></th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id} style={{ opacity: m.isActive ? 1 : 0.6 }}>
                      <td><Avatar member={m} /></td>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{m.name ?? "—"}</td>
                      <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{m.email}</td>
                      <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{m.phone ?? "—"}</td>
                      <td>
                        <span className="badge" style={{ background: `${roleColor(m.firmRole)}18`, color: roleColor(m.firmRole), borderColor: `${roleColor(m.firmRole)}30` }}>
                          {roleLabel(m.firmRole)}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: m.isActive ? "#10b981" : "#ef4444" }} />
                          {m.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <IconBtn title="View" onClick={() => setViewTarget(m)}><Eye size={14} /></IconBtn>
                          <IconBtn title="Edit" onClick={() => setEditTarget(m)}><Pencil size={14} /></IconBtn>
                          <IconBtn title={m.isActive ? "Deactivate" : "Activate"} danger={m.isActive} onClick={() => toggleActive(m)}><Power size={14} /></IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Invites */}
      {tab === "invites" && (
        invites.length === 0 ? (
          <EmptyState icon={<Mail size={46} color="var(--text-muted)" />} title="No pending invites" body="Invites you send appear here until the member signs up." />
        ) : (
          <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
            {invites.map((inv, i) => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i === 0 ? "none" : "1px solid var(--border)", flexWrap: "wrap" }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${roleColor(inv.firmRole)}20`, color: roleColor(inv.firmRole), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
                  {(inv.name ?? inv.email).charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{inv.name ?? inv.email}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {inv.email} · {roleLabel(inv.firmRole)}
                    {inv.expiresAt && ` · expires ${new Date(inv.expiresAt).toLocaleDateString("en-IN")}`}
                  </p>
                </div>
                <span className="badge" style={{ background: inv.status === "EXPIRED" ? "#ef444418" : "#f59e0b18", color: inv.status === "EXPIRED" ? "#ef4444" : "#f59e0b", borderColor: inv.status === "EXPIRED" ? "#ef444430" : "#f59e0b30" }}>
                  {inv.status === "EXPIRED" ? "Expired" : "Pending"}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <IconBtn title="Edit" onClick={() => setEditTarget(inv)}><Pencil size={14} /></IconBtn>
                  <IconBtn title="Resend" onClick={() => resendInvite(inv)}><RefreshCw size={14} /></IconBtn>
                  <IconBtn title="Revoke" danger onClick={() => revokeInvite(inv)}><Trash2 size={14} /></IconBtn>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Activity */}
      {tab === "activity" && <ActivityLog activity={activity} />}

      {/* Import history */}
      {tab === "imports" && (
        importHistory.length === 0 ? (
          <EmptyState icon={<History size={46} color="var(--text-muted)" />} title="No imports yet" body="CSV imports you run appear here with their date and record count." />
        ) : (
          <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
            {importHistory.map((a, i) => {
              const meta = (a.metadata ?? {}) as Record<string, unknown>;
              const count = Number(meta.created ?? meta.count ?? meta.imported ?? 0);
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(99,102,241,0.12)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Upload size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
                      {count > 0 ? `${count} member${count !== 1 ? "s" : ""} imported` : "Members imported"}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>by {a.actorName ?? "Someone"}</p>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(a.createdAt).toLocaleString("en-IN")}</span>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modals */}
      {addOpen && <MemberFormModal mode="add" onClose={() => setAddOpen(false)} onSaved={refresh} />}
      {editTarget && <MemberFormModal mode="edit" member={editTarget} onClose={() => setEditTarget(null)} onSaved={refresh} />}
      {permTarget && <PermissionModal member={permTarget} onClose={() => setPermTarget(null)} onSaved={refresh} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImported={refresh} />}
      {viewTarget && (
        <ViewMemberModal
          member={viewTarget}
          onClose={() => setViewTarget(null)}
          onEdit={() => { setEditTarget(viewTarget); setViewTarget(null); }}
          onPerms={() => { setPermTarget(viewTarget); setViewTarget(null); }}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function Avatar({ member, size = 34 }: { member: TeamMember; size?: number }) {
  const color = roleColor(member.firmRole);
  if (member.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={member.avatarUrl} alt={member.name ?? member.email} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `${color}20`, color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.4, flexShrink: 0 }}>
      {(member.name ?? member.email).charAt(0).toUpperCase()}
    </div>
  );
}

function ViewMemberModal({
  member,
  onClose,
  onEdit,
  onPerms,
}: {
  member: TeamMember;
  onClose: () => void;
  onEdit: () => void;
  onPerms: () => void;
}) {
  const spec = specLabel(member.specialization);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="section-card" style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <Avatar member={member} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>{member.name ?? "—"}</p>
            <span className="badge" style={{ background: `${roleColor(member.firmRole)}18`, color: roleColor(member.firmRole), borderColor: `${roleColor(member.firmRole)}30` }}>
              {roleLabel(member.firmRole)}
            </span>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <DetailRow label="Email" value={member.email} />
          <DetailRow label="Phone" value={member.phone ?? "—"} />
          {spec && <DetailRow label="Specialization" value={spec} />}
          <DetailRow label="Status" value={member.isActive ? "Active" : "Inactive"} />
          {member.joiningDate && <DetailRow label="Joined" value={new Date(member.joiningDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div style={{ padding: "12px", background: "var(--bg-elevated)", borderRadius: 8, textAlign: "center" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#0ea5e9" }}>{member.customerCount}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Customers</p>
          </div>
          <div style={{ padding: "12px", background: "var(--bg-elevated)", borderRadius: 8, textAlign: "center" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{member.openTaskCount}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Open Tasks</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onEdit} style={{ ...toolbarBtn(false), flex: 1, justifyContent: "center" }}><Pencil size={14} /> Edit</button>
          <button onClick={onPerms} style={{ ...toolbarBtn(false), flex: 1, justifyContent: "center" }}>Permissions</button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 500, textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer", color: danger ? "#ef4444" : "var(--text-secondary)" }}>
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

const selectStyle: React.CSSProperties = {
  padding: "9px 12px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 13,
  cursor: "pointer",
};

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
