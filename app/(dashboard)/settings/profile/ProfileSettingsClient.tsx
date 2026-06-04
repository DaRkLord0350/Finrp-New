"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Building,
  Camera,
  Save,
  Key,
  LogOut,
  Shield,
  Clock,
  CheckCircle,
} from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { toast } from "sonner";

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  designation: string | null;
  department: string | null;
  avatarUrl: string | null;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function ProfileSettingsClient({ initialProfile }: { initialProfile: Profile | null }) {
  const { signOut, openUserProfile } = useClerk();
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initialProfile?.name ?? "",
    phone: initialProfile?.phone ?? "",
    designation: initialProfile?.designation ?? "",
    department: initialProfile?.department ?? "",
    avatarUrl: initialProfile?.avatarUrl ?? "",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      const updated = await res.json();
      setProfile((p) => ({ ...p!, ...updated }));
      toast.success("Profile updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, avatarUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  const roleColors: Record<string, string> = {
    OWNER: "#6366f1",
    ADMIN: "#8b5cf6",
    MANAGER: "#3b82f6",
    ACCOUNTANT: "#10b981",
    STAFF: "#f59e0b",
    VIEWER: "#6b7280",
  };

  return (
    <div style={{ padding: 32, maxWidth: 720 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 32 }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 4,
          }}
        >
          Profile Settings
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Manage your personal information and account preferences
        </p>
      </motion.div>

      {/* Avatar + Role */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 24,
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div style={{ position: "relative" }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: form.avatarUrl
                ? "transparent"
                : "linear-gradient(135deg, #6366f1, #10b981)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              border: "3px solid var(--border-strong)",
            }}
          >
            {form.avatarUrl ? (
              <img
                src={form.avatarUrl}
                alt="Avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 28, color: "white", fontWeight: 700 }}>
                {form.name?.[0]?.toUpperCase() || "?"}
              </span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "#6366f1",
              border: "2px solid var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Camera size={12} color="white" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleAvatarChange}
          />
        </div>

        <div style={{ flex: 1 }}>
          <p
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {profile?.name || "—"}
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
            {profile?.email}
          </p>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              color: roleColors[profile?.role ?? "STAFF"] ?? "#6b7280",
              background: `${roleColors[profile?.role ?? "STAFF"] ?? "#6b7280"}18`,
              padding: "3px 10px",
              borderRadius: 20,
              border: `1px solid ${roleColors[profile?.role ?? "STAFF"] ?? "#6b7280"}30`,
            }}
          >
            <Shield size={10} />
            {profile?.role}
          </span>
        </div>

        {profile?.lastLoginAt && (
          <div
            style={{
              textAlign: "right",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              <Clock size={12} />
              Last login
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {new Date(profile.lastLoginAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}
      </motion.div>

      {/* Profile Form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 20,
          }}
        >
          Personal Information
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <FieldInput
            label="Full Name"
            icon={<User size={14} />}
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="Your full name"
            required
          />
          <FieldInput
            label="Email Address"
            icon={<Mail size={14} />}
            value={profile?.email ?? ""}
            onChange={() => {}}
            placeholder="Email"
            disabled
            hint="Email is managed by Clerk"
          />
          <FieldInput
            label="Phone Number"
            icon={<Phone size={14} />}
            value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            placeholder="+91 98765 43210"
          />
          <FieldInput
            label="Designation"
            icon={<Briefcase size={14} />}
            value={form.designation}
            onChange={(v) => setForm((f) => ({ ...f, designation: v }))}
            placeholder="e.g. Finance Manager"
          />
          <FieldInput
            label="Department"
            icon={<Building size={14} />}
            value={form.department}
            onChange={(v) => setForm((f) => ({ ...f, department: v }))}
            placeholder="e.g. Accounts"
          />
        </div>

        <div
          style={{
            marginTop: 20,
            paddingTop: 20,
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              background: saving ? "var(--bg-elevated)" : "#6366f1",
              color: saving ? "var(--text-muted)" : "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </motion.div>

      {/* Account Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 16,
          }}
        >
          Account Actions
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ActionRow
            icon={<Key size={16} />}
            label="Change Password"
            description="Update your Clerk account password and security options"
            action="Manage"
            onClick={() => openUserProfile()}
            color="#6366f1"
          />
          <ActionRow
            icon={<CheckCircle size={16} />}
            label="Two-Factor Authentication"
            description="Add an extra layer of security to your account"
            action="Configure"
            onClick={() => openUserProfile()}
            color="#10b981"
          />
          <ActionRow
            icon={<LogOut size={16} />}
            label="Sign Out"
            description="Sign out from this device"
            action="Sign Out"
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            color="#ef4444"
            danger
          />
        </div>
      </motion.div>

      {/* Member Since */}
      <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
        Member since{" "}
        {profile?.createdAt
          ? new Date(profile.createdAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "—"}
      </p>
    </div>
  );
}

function FieldInput({
  label,
  icon,
  value,
  onChange,
  placeholder,
  required,
  disabled,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text-secondary)",
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
        {required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
      </label>
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
          }}
        >
          {icon}
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: "100%",
            padding: "10px 12px 10px 36px",
            background: disabled ? "var(--bg-elevated)" : "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 14,
            color: disabled ? "var(--text-muted)" : "var(--text-primary)",
            outline: "none",
            cursor: disabled ? "not-allowed" : "text",
            boxSizing: "border-box",
          }}
          onFocus={(e) => {
            if (!disabled)
              e.currentTarget.style.borderColor = "#6366f1";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        />
      </div>
      {hint && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function ActionRow({
  icon,
  label,
  description,
  action,
  onClick,
  color,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  action: string;
  onClick: () => void;
  color: string;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 16px",
        background: "var(--bg-elevated)",
        borderRadius: 10,
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `${color}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 2,
          }}
        >
          {label}
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{description}</p>
      </div>
      <button
        onClick={onClick}
        style={{
          padding: "8px 16px",
          background: danger ? "#ef444420" : `${color}18`,
          color: danger ? "#ef4444" : color,
          border: `1px solid ${danger ? "#ef444440" : `${color}30`}`,
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "all 0.15s",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = danger ? "#ef444430" : `${color}28`;
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = danger ? "#ef444420" : `${color}18`;
        }}
      >
        {action}
      </button>
    </div>
  );
}
