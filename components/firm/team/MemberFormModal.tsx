"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Modal,
  labelStyle,
  inputStyle,
  fieldGap,
  primaryBtnStyle,
  secondaryBtnStyle,
} from "./Modal";
import {
  FIRM_MEMBER_ROLES,
  SPECIALIZATIONS,
  FIRM_ROLE_LABELS,
  SPECIALIZATION_LABELS,
  EMAIL_REGEX,
} from "@/lib/team/constants";
import type { TeamMember } from "./types";

interface Props {
  mode: "add" | "edit";
  member?: TeamMember;
  onClose: () => void;
  onSaved: () => void;
}

export function MemberFormModal({ mode, member, onClose, onSaved }: Props) {
  const isEdit = mode === "edit";
  const isUser = member?.kind === "user";

  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [firmRole, setFirmRole] = useState(member?.firmRole ?? "CA");
  const [specialization, setSpecialization] = useState(member?.specialization ?? "");
  const [joiningDate, setJoiningDate] = useState(
    member?.joiningDate ? member.joiningDate.slice(0, 10) : ""
  );
  const [status, setStatus] = useState(member?.isActive === false ? "INACTIVE" : "ACTIVE");
  const [sendInvite, setSendInvite] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) return toast.error("Full name is required");
    if (!isEdit) {
      if (!email.trim() || !EMAIL_REGEX.test(email.trim()))
        return toast.error("A valid email is required");
    }

    setSaving(true);
    try {
      let res: Response;
      if (!isEdit) {
        res = await fetch("/api/firm/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || null,
            firmRole,
            specialization: specialization || null,
            joiningDate: joiningDate || null,
            sendInvite,
          }),
        });
      } else {
        res = await fetch(`/api/firm/team/${member!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: member!.kind,
            name: name.trim(),
            phone: phone.trim() || null,
            firmRole,
            specialization: specialization || null,
            joiningDate: joiningDate || null,
            ...(isUser ? { status } : {}),
          }),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");

      toast.success(
        isEdit ? "Member updated" : sendInvite ? `Invite sent to ${email.trim()}` : "Member added"
      );
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? "Edit Team Member" : "Add Team Member"}
      subtitle={
        isEdit
          ? member?.email
          : "They'll receive an invite to join your firm and appear under Pending Invites until they accept."
      }
      onClose={onClose}
    >
      <div style={fieldGap}>
        <label style={labelStyle}>Full Name *</label>
        <input
          style={inputStyle}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rahul Sharma"
        />
      </div>

      <div style={fieldGap}>
        <label style={labelStyle}>Email {!isEdit && "*"}</label>
        <input
          style={{ ...inputStyle, opacity: isEdit ? 0.6 : 1, cursor: isEdit ? "not-allowed" : "text" }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="rahul@firm.com"
          type="email"
          disabled={isEdit}
        />
        {isEdit && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Email is tied to the login and can&apos;t be changed here.
          </p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, ...fieldGap }}>
        <div>
          <label style={labelStyle}>Phone</label>
          <input
            style={inputStyle}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9999999999"
          />
        </div>
        <div>
          <label style={labelStyle}>Joining Date</label>
          <input
            style={inputStyle}
            value={joiningDate}
            onChange={(e) => setJoiningDate(e.target.value)}
            type="date"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, ...fieldGap }}>
        <div>
          <label style={labelStyle}>Role *</label>
          <select style={inputStyle} value={firmRole} onChange={(e) => setFirmRole(e.target.value)}>
            {FIRM_MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {FIRM_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Specialization</label>
          <select
            style={inputStyle}
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
          >
            <option value="">— None —</option>
            {SPECIALIZATIONS.map((s) => (
              <option key={s} value={s}>
                {SPECIALIZATION_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isEdit && isUser && (
        <div style={fieldGap}>
          <label style={labelStyle}>Status</label>
          <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      )}

      {!isEdit && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--text-secondary)",
            cursor: "pointer",
            ...fieldGap,
          }}
        >
          <input
            type="checkbox"
            checked={sendInvite}
            onChange={(e) => setSendInvite(e.target.checked)}
            style={{ width: 15, height: 15, accentColor: "#6366f1" }}
          />
          Send invitation email now
        </label>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button onClick={onClose} style={secondaryBtnStyle}>
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving} style={primaryBtnStyle(saving)}>
          {saving ? "Saving…" : isEdit ? "Save Changes" : sendInvite ? "Add & Send Invite" : "Add Member"}
        </button>
      </div>
    </Modal>
  );
}
