"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  MoreVertical,
  Trash2,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Can } from "@/components/auth/Can";

const ROLES = ["OWNER", "ADMIN", "MANAGER", "ACCOUNTANT", "STAFF", "VIEWER"] as const;
type Role = (typeof ROLES)[number];

const ROLE_META: Record<Role, { color: string; desc: string }> = {
  OWNER: { color: "#6366f1", desc: "Full access to everything" },
  ADMIN: { color: "#8b5cf6", desc: "Manage settings and all modules" },
  MANAGER: { color: "#3b82f6", desc: "Manage operations, limited settings" },
  ACCOUNTANT: { color: "#10b981", desc: "Finance, invoices, payroll" },
  STAFF: { color: "#f59e0b", desc: "Read and create basic records" },
  VIEWER: { color: "#6b7280", desc: "View-only access" },
};

const PERMISSIONS: Record<Role, string[]> = {
  OWNER: ["Dashboard", "CRM", "Billing", "Finance", "ERP", "Compliance", "Loans", "Inventory", "Settings", "Users"],
  ADMIN: ["Dashboard", "CRM", "Billing", "Finance", "ERP", "Compliance", "Loans", "Inventory", "Settings"],
  MANAGER: ["Dashboard", "CRM", "Billing", "Finance", "ERP", "Compliance", "Inventory"],
  ACCOUNTANT: ["Dashboard", "Billing", "Finance", "Compliance", "Payroll"],
  STAFF: ["Dashboard", "CRM", "Billing", "Inventory"],
  VIEWER: ["Dashboard", "CRM", "Finance"],
};

interface Member {
  id: string;
  name: string | null;
  email: string;
  designation: string | null;
  department: string | null;
  role: Role;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
}

export default function UsersSettingsClient({ initialMembers, initialInvitations }: { initialMembers: Member[]; initialInvitations: Invitation[] }) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations);
  const [showInvite, setShowInvite] = useState(false);
  const [showRoleMatrix, setShowRoleMatrix] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("STAFF");
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/settings/users");
      const data = await res.json();
      setMembers(data.members);
      setInvitations(data.invitations);
    } catch {
      toast.error("Failed to refresh team members");
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return toast.error("Email is required");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) return toast.error("Invalid email");
    try {
      setInviting(true);
      const res = await fetch("/api/settings/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.resent ? `Invitation re-sent to ${inviteEmail}` : `Invitation sent to ${inviteEmail}`);
      setShowInvite(false);
      setInviteEmail("");
      setInviteRole("STAFF");
      fetchUsers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, role: Role) {
    try {
      const res = await fetch("/api/settings/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success("Role updated");
      setActiveMenu(null);
      fetchUsers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update role");
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm("Remove this team member?")) return;
    try {
      const res = await fetch(`/api/settings/users?memberId=${memberId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success("Member removed");
      setActiveMenu(null);
      fetchUsers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to remove member");
    }
  }

  async function handleResendInvite(inv: Invitation) {
    try {
      setResendingId(inv.id);
      const res = await fetch("/api/settings/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inv.email, role: inv.role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Invitation re-sent to ${inv.email}`);
      fetchUsers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to resend invitation");
    } finally {
      setResendingId(null);
    }
  }

  async function handleCancelInvite(inviteId: string) {
    try {
      const res = await fetch(`/api/settings/invitations?id=${inviteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Invitation cancelled");
      fetchUsers();
    } catch {
      toast.error("Failed to cancel invitation");
    }
  }


  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 32,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Users & Roles
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {members.length} member{members.length !== 1 ? "s" : ""} · {invitations.length} pending invite{invitations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setShowRoleMatrix(!showRoleMatrix)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 16px",
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Shield size={14} />
            Permissions
          </button>
          <Can permission="users.manage">
            <button
              onClick={() => setShowInvite(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 16px",
                background: "#6366f1",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <UserPlus size={14} />
              Invite Member
            </button>
          </Can>
        </div>
      </motion.div>

      {/* Role Permission Matrix */}
      <AnimatePresence>
        {showRoleMatrix && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginBottom: 20,
              overflow: "hidden",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
              Role Permission Matrix
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>
                      Module
                    </th>
                    {ROLES.map((r) => (
                      <th
                        key={r}
                        style={{
                          textAlign: "center",
                          padding: "8px 12px",
                          color: ROLE_META[r].color,
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        {r}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {["Dashboard", "CRM", "Billing", "Finance", "ERP", "Compliance", "Loans", "Inventory", "Payroll", "Settings", "Users"].map((module) => (
                    <tr
                      key={module}
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <td style={{ padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>
                        {module}
                      </td>
                      {ROLES.map((r) => (
                        <td key={r} style={{ textAlign: "center", padding: "8px 12px" }}>
                          {PERMISSIONS[r].includes(module) ? (
                            <CheckCircle size={14} color="#10b981" />
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: 16 }}>—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Members */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            <Users size={15} style={{ marginRight: 8, verticalAlign: "middle" }} />
            Team Members
          </h2>
        </div>
        <div>
          {members.map((member, idx) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 24px",
                borderBottom: idx < members.length - 1 ? "1px solid var(--border)" : "none",
                position: "relative",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: member.avatarUrl
                    ? "transparent"
                    : `${ROLE_META[member.role]?.color ?? "#6366f1"}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                  border: `2px solid ${ROLE_META[member.role]?.color ?? "#6366f1"}30`,
                }}
              >
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 15, fontWeight: 700, color: ROLE_META[member.role]?.color ?? "#6366f1" }}>
                    {(member.name || member.email)[0].toUpperCase()}
                  </span>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  {member.name || "—"}
                  {!member.isActive && (
                    <span style={{ fontSize: 11, color: "#ef4444", marginLeft: 8 }}>Inactive</span>
                  )}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{member.email}</p>
                {member.designation && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{member.designation}</p>
                )}
              </div>

              {/* Role badge */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 20,
                  color: ROLE_META[member.role]?.color ?? "#6366f1",
                  background: `${ROLE_META[member.role]?.color ?? "#6366f1"}15`,
                  border: `1px solid ${ROLE_META[member.role]?.color ?? "#6366f1"}25`,
                }}
              >
                {member.role}
              </span>

              {/* Last login */}
              {member.lastLoginAt && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
                  <Clock size={11} />
                  {new Date(member.lastLoginAt).toLocaleDateString("en-IN")}
                </div>
              )}

              {/* Actions */}
              {member.role !== "OWNER" && (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setActiveMenu(activeMenu === member.id ? null : member.id)}
                    style={{
                      width: 30,
                      height: 30,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "transparent",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "var(--text-muted)",
                    }}
                  >
                    <MoreVertical size={15} />
                  </button>
                  <AnimatePresence>
                    {activeMenu === member.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 36,
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          padding: 8,
                          zIndex: 50,
                          minWidth: 180,
                          boxShadow: "var(--shadow-lg)",
                        }}
                      >
                        <p style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 8px 8px", fontWeight: 600 }}>
                          Change Role
                        </p>
                        {(["ADMIN", "MANAGER", "ACCOUNTANT", "STAFF", "VIEWER"] as Role[]).map((r) => (
                          <button
                            key={r}
                            onClick={() => handleRoleChange(member.id, r)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              width: "100%",
                              padding: "6px 8px",
                              background: member.role === r ? `${ROLE_META[r].color}15` : "transparent",
                              border: "none",
                              borderRadius: 6,
                              cursor: "pointer",
                              fontSize: 13,
                              color: member.role === r ? ROLE_META[r].color : "var(--text-secondary)",
                              textAlign: "left",
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: ROLE_META[r].color,
                                flexShrink: 0,
                              }}
                            />
                            {r}
                          </button>
                        ))}
                        <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              width: "100%",
                              padding: "6px 8px",
                              background: "transparent",
                              border: "none",
                              borderRadius: 6,
                              cursor: "pointer",
                              fontSize: 13,
                              color: "#ef4444",
                              textAlign: "left",
                            }}
                          >
                            <Trash2 size={12} />
                            Remove Member
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              <Mail size={15} style={{ marginRight: 8, verticalAlign: "middle" }} />
              Pending Invitations ({invitations.length})
            </h2>
          </div>
          {invitations.map((inv) => (
            <div
              key={inv.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 24px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#f59e0b20",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AlertCircle size={16} color="#f59e0b" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{inv.email}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Invited as {inv.role} · Expires {new Date(inv.expiresAt).toLocaleDateString("en-IN")}
                </p>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 20,
                  color: ROLE_META[inv.role]?.color,
                  background: `${ROLE_META[inv.role]?.color}15`,
                }}
              >
                {inv.role}
              </span>
              <button
                onClick={() => handleResendInvite(inv)}
                disabled={resendingId === inv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 12px",
                  background: "#6366f120",
                  color: "#6366f1",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: resendingId === inv.id ? "not-allowed" : "pointer",
                }}
              >
                <Send size={12} />
                {resendingId === inv.id ? "Sending…" : "Resend"}
              </button>
              <button
                onClick={() => handleCancelInvite(inv.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 12px",
                  background: "#ef444420",
                  color: "#ef4444",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <X size={12} />
                Cancel
              </button>
            </div>
          ))}
        </motion.div>
      )}

      {/* Invite Modal */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: 16,
            }}
            onClick={() => setShowInvite(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: 28,
                width: "100%",
                maxWidth: 440,
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
                  Invite Team Member
                </h3>
                <button onClick={() => setShowInvite(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Email Address *
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    type="email"
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 36px",
                      background: "var(--bg-base)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 14,
                      color: "var(--text-primary)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Role *
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(["ADMIN", "MANAGER", "ACCOUNTANT", "STAFF", "VIEWER"] as Role[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setInviteRole(r)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        background: inviteRole === r ? `${ROLE_META[r].color}15` : "var(--bg-base)",
                        border: `1px solid ${inviteRole === r ? ROLE_META[r].color : "var(--border)"}`,
                        borderRadius: 8,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: ROLE_META[r].color,
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: inviteRole === r ? ROLE_META[r].color : "var(--text-primary)" }}>
                          {r}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{ROLE_META[r].desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setShowInvite(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  disabled={inviting}
                  style={{
                    flex: 2,
                    padding: "10px",
                    background: inviting ? "var(--bg-overlay)" : "#6366f1",
                    color: inviting ? "var(--text-muted)" : "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: inviting ? "not-allowed" : "pointer",
                  }}
                >
                  {inviting ? "Sending…" : "Send Invitation"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div style={{ padding: 32 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ height: 80, background: "var(--bg-elevated)", borderRadius: 14, marginBottom: 16, animation: "pulse 2s infinite" }} />
      ))}
    </div>
  );
}
