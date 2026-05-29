"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Package,
  DollarSign,
  Users,
  Save,
} from "lucide-react";
import { toast } from "sonner";

interface NotificationConfig {
  org: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    overdueReminderDays: number;
    lowStockThreshold: number;
  } | null;
  user: Record<string, boolean>;
}

const NOTIFICATION_TYPES = [
  {
    key: "gstReminders",
    label: "GST Reminders",
    description: "Filing deadlines and due dates",
    icon: FileText,
    color: "#6366f1",
  },
  {
    key: "invoiceReminders",
    label: "Invoice Overdue",
    description: "Alert when invoices become overdue",
    icon: DollarSign,
    color: "#10b981",
  },
  {
    key: "syncFailures",
    label: "Sync Failures",
    description: "When Zoho/Tally sync fails",
    icon: AlertTriangle,
    color: "#f59e0b",
  },
  {
    key: "securityAlerts",
    label: "Security Alerts",
    description: "New logins and account activity",
    icon: ShieldCheck,
    color: "#ef4444",
  },
  {
    key: "lowStock",
    label: "Low Stock Alerts",
    description: "Inventory below threshold",
    icon: Package,
    color: "#8b5cf6",
  },
  {
    key: "teamActivity",
    label: "Team Activity",
    description: "Member invites and role changes",
    icon: Users,
    color: "#3b82f6",
  },
];

export default function NotificationsPage() {
  const [config, setConfig] = useState<NotificationConfig>({ org: null, user: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [orgEmail, setOrgEmail] = useState(true);
  const [orgSms, setOrgSms] = useState(false);
  const [overdueReminderDays, setOverdueReminderDays] = useState(3);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [userPrefs, setUserPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/settings/notifications")
      .then((r) => r.json())
      .then((d: NotificationConfig) => {
        setConfig(d);
        if (d.org) {
          setOrgEmail(d.org.emailNotifications);
          setOrgSms(d.org.smsNotifications);
          setOverdueReminderDays(d.org.overdueReminderDays);
          setLowStockThreshold(d.org.lowStockThreshold);
        }
        const prefs: Record<string, boolean> = {};
        NOTIFICATION_TYPES.forEach((t) => {
          prefs[t.key] = d.user?.[t.key] !== false; // default true
        });
        setUserPrefs(prefs);
      })
      .catch(() => toast.error("Failed to load notification settings"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgSettings: {
            emailNotifications: orgEmail,
            smsNotifications: orgSms,
            overdueReminderDays,
            lowStockThreshold,
          },
          userPreferences: userPrefs,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Notification settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ height: 100, background: "var(--bg-elevated)", borderRadius: 14, marginBottom: 16, animation: "pulse 2s infinite" }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 720 }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Notification Settings
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Control how and when you receive alerts and reminders
        </p>
      </motion.div>

      {/* Channels */}
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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <Bell size={16} color="#6366f1" />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            Notification Channels
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ChannelRow
            icon={<Mail size={16} />}
            label="Email Notifications"
            description="Receive alerts via email"
            checked={orgEmail}
            onChange={setOrgEmail}
            color="#6366f1"
          />
          <ChannelRow
            icon={<Smartphone size={16} />}
            label="SMS Notifications"
            description="Receive alerts via SMS (charges may apply)"
            checked={orgSms}
            onChange={setOrgSms}
            color="#10b981"
            badge="Coming Soon"
          />
          <ChannelRow
            icon={<MessageSquare size={16} />}
            label="In-App Notifications"
            description="Always enabled — alerts appear in FinRP"
            checked={true}
            onChange={() => {}}
            color="#3b82f6"
            disabled
          />
        </div>
      </motion.div>

      {/* Thresholds */}
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
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 20 }}>
          Alert Thresholds
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Overdue Invoice Reminder (days before)
            </label>
            <input
              type="number"
              min="0"
              max="30"
              value={overdueReminderDays}
              onChange={(e) => setOverdueReminderDays(parseInt(e.target.value))}
              style={{
                width: "100%",
                padding: "10px 12px",
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
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Low Stock Alert (units below)
            </label>
            <input
              type="number"
              min="1"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(parseInt(e.target.value))}
              style={{
                width: "100%",
                padding: "10px 12px",
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
      </motion.div>

      {/* Notification Types */}
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
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 20 }}>
          Notification Types
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {NOTIFICATION_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <div
                key={type.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 16px",
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
                    background: `${type.color}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: type.color,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                    {type.label}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{type.description}</p>
                </div>
                <button
                  onClick={() =>
                    setUserPrefs((p) => ({ ...p, [type.key]: !p[type.key] }))
                  }
                  style={{
                    width: 42,
                    height: 24,
                    borderRadius: 12,
                    background: userPrefs[type.key] !== false ? type.color : "var(--bg-overlay)",
                    border: "none",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.2s",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: userPrefs[type.key] !== false ? 20 : 2,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "white",
                      transition: "left 0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 24px",
            background: saving ? "var(--bg-elevated)" : "#6366f1",
            color: saving ? "var(--text-muted)" : "white",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          <Save size={14} />
          {saving ? "Saving…" : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}

function ChannelRow({
  icon,
  label,
  description,
  checked,
  onChange,
  color,
  badge,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color: string;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: checked ? `${color}08` : "var(--bg-elevated)",
        borderRadius: 10,
        border: `1px solid ${checked ? `${color}25` : "var(--border)"}`,
        transition: "all 0.2s",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 8,
          background: `${color}15`,
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{label}</p>
          {badge && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 20,
                background: "#f59e0b20",
                color: "#f59e0b",
                border: "1px solid #f59e0b30",
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        style={{
          width: 42,
          height: 24,
          borderRadius: 12,
          background: checked ? color : "var(--bg-overlay)",
          border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 20 : 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "white",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </button>
    </div>
  );
}
