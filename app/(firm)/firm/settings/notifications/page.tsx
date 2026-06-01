"use client";

import { useState, useEffect } from "react";
import { Bell, Mail, MessageSquare, Save } from "lucide-react";

interface NotifSettings {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  reminderDays1: boolean;
  reminderDays3: boolean;
  reminderDays7: boolean;
  notifyAssignment: boolean;
  notifyTaskCreated: boolean;
  notifyTaskDue: boolean;
  notifyTaskOverdue: boolean;
  notifyDocApproved: boolean;
  notifyDocRejected: boolean;
  notifyMessage: boolean;
  resendApiKey: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioWhatsappFrom: string;
}

const defaultSettings: NotifSettings = {
  emailEnabled: true, whatsappEnabled: false,
  reminderDays1: true, reminderDays3: true, reminderDays7: false,
  notifyAssignment: true, notifyTaskCreated: true, notifyTaskDue: true,
  notifyTaskOverdue: true, notifyDocApproved: true, notifyDocRejected: true,
  notifyMessage: true,
  resendApiKey: "", twilioAccountSid: "", twilioAuthToken: "", twilioWhatsappFrom: "",
};

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</p>
        {desc && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 99, flexShrink: 0, marginLeft: 12,
          background: checked ? "var(--brand-500, #6366f1)" : "var(--border)",
          border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s ease",
        }}
      >
        <div style={{
          position: "absolute", top: 3, left: checked ? 21 : 3, width: 16, height: 16,
          borderRadius: "50%", background: "white", transition: "left 0.2s ease",
        }} />
      </button>
    </div>
  );
}

function SecretInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>{label}</label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? ""}
        autoComplete="off"
        style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none" }}
      />
    </div>
  );
}

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState<NotifSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/firm/notifications/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings({ ...defaultSettings, ...d.settings, resendApiKey: "", twilioAccountSid: "", twilioAuthToken: "", twilioWhatsappFrom: d.settings.twilioWhatsappFrom ?? "" });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const set = (key: keyof NotifSettings) => (v: boolean | string) =>
    setSettings((s) => ({ ...s, [key]: v }));

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/firm/notifications/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setSettings((s) => ({ ...s, resendApiKey: "", twilioAccountSid: "", twilioAuthToken: "" }));
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-container"><div className="section-card"><div className="empty-state"><div className="loading-spinner" /></div></div></div>;
  }

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="section-title">Notification Settings</h1>
          <p className="section-subtitle">Configure email and WhatsApp alerts for your firm</p>
        </div>
        <button onClick={handleSave} className="btn-brand" disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <Save size={14} />{saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Channels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Mail size={15} color="#6366f1" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Email (Resend)</h3>
            </div>
            <Toggle label="Enable Email Notifications" desc="Send email alerts to clients and CAs" checked={settings.emailEnabled} onChange={(v) => set("emailEnabled")(v)} />
            {settings.emailEnabled && (
              <div style={{ marginTop: 14 }}>
                <SecretInput label="Resend API Key" value={settings.resendApiKey} onChange={(v) => set("resendApiKey")(v)} placeholder="re_xxxxxxxxxxxx (leave blank to keep existing)" />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Get your API key from <a href="https://resend.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand-400)" }}>resend.com</a>. Set RESEND_FROM_EMAIL env var for the sender address.</p>
              </div>
            )}
          </div>

          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <MessageSquare size={15} color="#25d366" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>WhatsApp (Twilio)</h3>
            </div>
            <Toggle label="Enable WhatsApp Notifications" desc="Send WhatsApp messages via Twilio" checked={settings.whatsappEnabled} onChange={(v) => set("whatsappEnabled")(v)} />
            {settings.whatsappEnabled && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
                <SecretInput label="Twilio Account SID" value={settings.twilioAccountSid} onChange={(v) => set("twilioAccountSid")(v)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                <SecretInput label="Twilio Auth Token" value={settings.twilioAuthToken} onChange={(v) => set("twilioAuthToken")(v)} placeholder="Auth token (leave blank to keep existing)" />
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>WhatsApp From Number</label>
                  <input
                    value={settings.twilioWhatsappFrom}
                    onChange={(e) => set("twilioWhatsappFrom")(e.target.value)}
                    placeholder="whatsapp:+14155238886"
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Triggers */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Bell size={15} color="#f59e0b" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Reminder Timing</h3>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Send task due reminders N days before the deadline</p>
            <Toggle label="1 Day Before Due" checked={settings.reminderDays1} onChange={(v) => set("reminderDays1")(v)} />
            <Toggle label="3 Days Before Due" checked={settings.reminderDays3} onChange={(v) => set("reminderDays3")(v)} />
            <Toggle label="7 Days Before Due" checked={settings.reminderDays7} onChange={(v) => set("reminderDays7")(v)} />
          </div>

          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Bell size={15} color="#0ea5e9" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Notification Triggers</h3>
            </div>
            <Toggle label="New Assignment" desc="When a client is assigned to a CA" checked={settings.notifyAssignment} onChange={(v) => set("notifyAssignment")(v)} />
            <Toggle label="Task Created" desc="When a new compliance task is created" checked={settings.notifyTaskCreated} onChange={(v) => set("notifyTaskCreated")(v)} />
            <Toggle label="Task Due" desc="When a task is approaching its due date" checked={settings.notifyTaskDue} onChange={(v) => set("notifyTaskDue")(v)} />
            <Toggle label="Task Overdue" desc="When a task passes its due date" checked={settings.notifyTaskOverdue} onChange={(v) => set("notifyTaskOverdue")(v)} />
            <Toggle label="Document Approved" desc="When a document is approved by CA" checked={settings.notifyDocApproved} onChange={(v) => set("notifyDocApproved")(v)} />
            <Toggle label="Document Rejected" desc="When a document is rejected by CA" checked={settings.notifyDocRejected} onChange={(v) => set("notifyDocRejected")(v)} />
            <Toggle label="Message Received" desc="When a new message is received" checked={settings.notifyMessage} onChange={(v) => set("notifyMessage")(v)} />
          </div>
        </div>
      </div>
    </div>
  );
}
