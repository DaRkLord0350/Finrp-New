"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Modal, labelStyle, inputStyle, primaryBtnStyle, secondaryBtnStyle } from "./Modal";
import { WORKSPACE_PERMISSIONS, PERMISSION_LABELS } from "@/lib/workspace/permissions";
import { FIRM_MEMBER_ROLES, FIRM_ROLE_LABELS } from "@/lib/team/constants";
import type { ClientPermission } from "@prisma/client";
import type { TeamMember } from "./types";

interface Props {
  member: TeamMember;
  onClose: () => void;
  onSaved: () => void;
}

export function PermissionModal({ member, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(member.defaultPermissions));
  const [firmRole, setFirmRole] = useState(member.firmRole ?? "CA");
  const [saving, setSaving] = useState(false);

  function toggle(p: ClientPermission) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/firm/team/${member.id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: Array.from(selected), firmRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to update permissions");
      toast.success("Permissions updated");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update permissions");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Manage Permissions"
      subtitle={`${member.name ?? member.email} · applied when assigned to a client workspace`}
      onClose={onClose}
    >
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Firm Role</label>
        <select style={inputStyle} value={firmRole} onChange={(e) => setFirmRole(e.target.value)}>
          {FIRM_MEMBER_ROLES.map((r) => (
            <option key={r} value={r}>
              {FIRM_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <label style={labelStyle}>Workspace Access</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
        {WORKSPACE_PERMISSIONS.map((p) => {
          const on = selected.has(p);
          return (
            <button
              key={p}
              onClick={() => toggle(p)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                background: on ? "rgba(99,102,241,0.12)" : "var(--bg-base)",
                border: `1px solid ${on ? "#6366f1" : "var(--border)"}`,
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  flexShrink: 0,
                  background: on ? "#6366f1" : "transparent",
                  border: `1px solid ${on ? "#6366f1" : "var(--border-strong, var(--border))"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {on && <Check size={12} color="white" />}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: on ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                {PERMISSION_LABELS[p]}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={secondaryBtnStyle}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} style={primaryBtnStyle(saving)}>
          {saving ? "Saving…" : "Save Permissions"}
        </button>
      </div>
    </Modal>
  );
}
