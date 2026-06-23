"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Mail, Phone, CalendarDays, Users, CheckCircle2, Clock, AlertTriangle, Network } from "lucide-react";
import { FIRM_ROLE_LABELS, FIRM_ROLE_COLORS } from "@/lib/team/constants";
import type { FirmMemberRole } from "@prisma/client";
import type { CaDirectoryItem, CaDetail, CaTaskItem } from "@/lib/firm/relationships";

const ACTIVITY_LABEL: Record<string, string> = {
  MEMBER_INVITED: "was invited",
  MEMBER_JOINED: "joined the firm",
  MEMBER_UPDATED: "profile updated",
  MEMBER_DEACTIVATED: "was deactivated",
  MEMBER_REACTIVATED: "was reactivated",
  PERMISSIONS_UPDATED: "permissions updated",
  CA_ASSIGNED: "was assigned customers",
  CA_REASSIGNED: "had customers reassigned",
  CA_UNASSIGNED: "had an assignment removed",
};

function roleColor(r: string | null) {
  return r && r in FIRM_ROLE_COLORS ? FIRM_ROLE_COLORS[r as FirmMemberRole] : "#94a3b8";
}
function roleLabel(r: string | null) {
  return r && r in FIRM_ROLE_LABELS ? FIRM_ROLE_LABELS[r as FirmMemberRole] : "Member";
}
function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

const PRIORITY_COLOR: Record<string, string> = { LOW: "#94a3b8", MEDIUM: "#0ea5e9", HIGH: "#f59e0b", CRITICAL: "#ef4444" };

type SubTab = "portfolio" | "open" | "completed" | "activity";

export function RelationshipsClient({
  directory,
  initialDetail,
}: {
  directory: CaDirectoryItem[];
  initialDetail: CaDetail | null;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialDetail?.id ?? null);
  const [detail, setDetail] = useState<CaDetail | null>(initialDetail);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>("portfolio");

  const filtered = directory.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
  );

  async function select(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    setSubTab("portfolio");
    setLoading(true);
    try {
      const res = await fetch(`/api/firm/relationships/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetail(data.detail);
    } catch {
      toast.error("Failed to load CA");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 20 }}>
        <h1 className="section-title">Relationships</h1>
        <p className="section-subtitle">Your CA team and the customers they own.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }} className="rel-grid">
        {/* Directory */}
        <div className="section-card" style={{ padding: 12 }}>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search CAs…" style={{ width: "100%", padding: "9px 12px 9px 36px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13 }} />
          </div>
          {filtered.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", padding: 12 }}>No CAs found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: "70vh", overflowY: "auto" }}>
              {filtered.map((c) => {
                const active = c.id === selectedId;
                return (
                  <button key={c.id} onClick={() => select(c.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", background: active ? "rgba(99,102,241,0.1)" : "transparent" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${roleColor(c.firmRole)}20`, color: roleColor(c.firmRole), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: active ? "var(--text-primary)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.customerCount} customer{c.customerCount !== 1 ? "s" : ""}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail */}
        <div>
          {!detail ? (
            <div className="section-card">
              <div className="empty-state">
                <Network size={42} color="var(--text-muted)" />
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                  {directory.length === 0 ? "No CAs yet" : "Select a CA"}
                </p>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {directory.length === 0 ? "Add team members to see relationships here." : "Pick a CA from the directory to view their portfolio."}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, opacity: loading ? 0.5 : 1, transition: "opacity 0.15s" }}>
              {/* Profile */}
              <div className="section-card">
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ width: 60, height: 60, borderRadius: "50%", background: `${roleColor(detail.firmRole)}20`, color: roleColor(detail.firmRole), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {detail.avatarUrl ? <img src={detail.avatarUrl} alt={detail.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : detail.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <h2 style={{ fontSize: 19, fontWeight: 700, color: "var(--text-primary)" }}>{detail.name}</h2>
                      <span className="badge" style={{ background: `${roleColor(detail.firmRole)}18`, color: roleColor(detail.firmRole), borderColor: `${roleColor(detail.firmRole)}30` }}>{roleLabel(detail.firmRole)}</span>
                      {!detail.isActive && <span className="badge" style={{ background: "#ef444418", color: "#ef4444", borderColor: "#ef444430" }}>Inactive</span>}
                    </div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Mail size={13} /> {detail.email}</span>
                      {detail.phone && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Phone size={13} /> {detail.phone}</span>}
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><CalendarDays size={13} /> Joined {fmt(detail.joiningDate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
                <MetricCard icon={<Users size={16} />} color="#6366f1" value={detail.metrics.customersAssigned} label="Customers Assigned" />
                <MetricCard icon={<CheckCircle2 size={16} />} color="#10b981" value={detail.metrics.tasksCompleted} label="Tasks Completed" />
                <MetricCard icon={<Clock size={16} />} color="#f59e0b" value={detail.metrics.tasksPending} label="Tasks Pending" />
                <MetricCard icon={<AlertTriangle size={16} />} color="#ef4444" value={detail.metrics.tasksOverdue} label="Tasks Overdue" />
              </div>

              {/* Sub-tabs */}
              <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", padding: "0 12px" }}>
                  {([
                    ["portfolio", `Portfolio (${detail.portfolio.length})`],
                    ["open", `Open Tasks (${detail.openTasks.length})`],
                    ["completed", `Completed (${detail.completedTasks.length})`],
                    ["activity", "Activity"],
                  ] as [SubTab, string][]).map(([key, label]) => (
                    <button key={key} onClick={() => setSubTab(key)} style={{ padding: "12px 12px", background: "transparent", border: "none", borderBottom: `2px solid ${subTab === key ? "#6366f1" : "transparent"}`, color: subTab === key ? "var(--text-primary)" : "var(--text-muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginBottom: -1 }}>
                      {label}
                    </button>
                  ))}
                </div>

                <div style={{ padding: 16 }}>
                  {subTab === "portfolio" && (
                    detail.portfolio.length === 0 ? <Muted text="No customers assigned." /> : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                        {detail.portfolio.map((c) => (
                          <Link key={c.id} href={`/firm/customers/${c.id}`} style={{ textDecoration: "none" }}>
                            <div style={{ padding: "12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10 }}>
                              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</p>
                              <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{c.company ?? "—"} · {c.openTasks} open task{c.openTasks !== 1 ? "s" : ""}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )
                  )}

                  {subTab === "open" && <TaskList tasks={detail.openTasks} kind="open" />}
                  {subTab === "completed" && <TaskList tasks={detail.completedTasks} kind="completed" />}

                  {subTab === "activity" && (
                    detail.timeline.length === 0 ? <Muted text="No recent activity." /> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {detail.timeline.map((a) => (
                          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />
                            <p style={{ flex: 1, fontSize: 12.5, color: "var(--text-secondary)" }}>
                              <strong style={{ color: "var(--text-primary)" }}>{detail.name}</strong>{" "}
                              {ACTIVITY_LABEL[a.action] ?? a.action.toLowerCase().replace(/_/g, " ")}
                              {a.targetEmail ? ` · ${a.targetEmail}` : ""}
                            </p>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmt(a.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskList({ tasks, kind }: { tasks: CaTaskItem[]; kind: "open" | "completed" }) {
  if (tasks.length === 0) return <Muted text={kind === "open" ? "No open tasks." : "No completed tasks."} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tasks.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_COLOR[t.priority] ?? "#94a3b8", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</p>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t.customerName}</p>
          </div>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", flexShrink: 0 }}>
            {kind === "open" ? `Due ${fmt(t.dueDate)}` : `Done ${fmt(t.completedAt)}`}
          </span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ icon, color, value, label }: { icon: React.ReactNode; color: string; value: number; label: string }) {
  return (
    <div className="stat-card">
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}1a`, color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>{icon}</div>
      <p style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{value}</p>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{label}</p>
    </div>
  );
}

function Muted({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0" }}>{text}</p>;
}
