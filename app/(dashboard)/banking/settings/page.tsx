"use client";

import { useState, useEffect } from "react";
import { Settings2, Bell, Shield, RefreshCw, Tag, Save, CheckCircle2 } from "lucide-react";

const SETTINGS_KEY = "banking_settings_v1";

const DEFAULT_SETTINGS = {
  autoSync: true, syncFrequency: "HOURLY", autoCategorizaion: true, duplicateDetection: true,
  notifyConsentExpiry: true, notifyLargeTransactions: true, largeTransactionThreshold: 500000,
  notifyReconciliationDue: true, defaultCurrency: "INR", fiscalYearStart: "APRIL",
  reconciliationReminder: 7, riskAlertMinSeverity: "MEDIUM",
  aiInsightsEnabled: true, gstMatchEnabled: true,
};

type Settings = typeof DEFAULT_SETTINGS;

export default function BankingSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
    } catch {}
  }, []);

  const save = () => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (key: keyof Settings, value: unknown) => setSettings(s => ({ ...s, [key]: value }));

  const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ color: "#6366f1" }}>{icon}</div>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );

  const Toggle = ({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</p>
        {desc && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{desc}</p>}
      </div>
      <button onClick={() => onChange(!checked)} style={{ width: 40, height: 22, borderRadius: 11, border: "none", background: checked ? "#6366f1" : "var(--border)", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
        <span style={{ position: "absolute", top: 3, left: checked ? 20 : 3, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 0.2s", display: "block" }} />
      </button>
    </div>
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
      <p style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</p>
      {children}
    </div>
  );

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Banking Settings</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Configure sync, notifications, categorization, and risk preferences</p>
        </div>
        <button onClick={save} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "8px 16px", borderRadius: 8, border: "none", background: saved ? "#10b981" : "#6366f1", color: "white", cursor: "pointer", fontWeight: 600, transition: "background 0.2s" }}>
          {saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Section title="Sync & Data" icon={<RefreshCw size={14} />}>
            <Toggle label="Auto Sync" desc="Automatically sync connected accounts" checked={settings.autoSync} onChange={v => set("autoSync", v)} />
            <Field label="Sync Frequency">
              <select value={settings.syncFrequency} onChange={e => set("syncFrequency", e.target.value)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                {["REAL_TIME", "HOURLY", "EVERY_6_HOURS", "DAILY"].map(o => <option key={o} value={o}>{o.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
            </Field>
            <Toggle label="Duplicate Detection" desc="Flag possible duplicate transactions" checked={settings.duplicateDetection} onChange={v => set("duplicateDetection", v)} />
          </Section>

          <Section title="Categorization" icon={<Tag size={14} />}>
            <Toggle label="Auto Categorize" desc="Use rules engine to auto-assign categories" checked={settings.autoCategorizaion} onChange={v => set("autoCategorizaion", v)} />
            <Toggle label="AI Insights" desc="Generate AI-powered cash flow insights" checked={settings.aiInsightsEnabled} onChange={v => set("aiInsightsEnabled", v)} />
            <Toggle label="GST Matching" desc="Match bank transactions to GSTR entries" checked={settings.gstMatchEnabled} onChange={v => set("gstMatchEnabled", v)} />
          </Section>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Section title="Notifications" icon={<Bell size={14} />}>
            <Toggle label="Consent Expiry Alerts" desc="Notify before AA consent expires" checked={settings.notifyConsentExpiry} onChange={v => set("notifyConsentExpiry", v)} />
            <Toggle label="Large Transaction Alerts" checked={settings.notifyLargeTransactions} onChange={v => set("notifyLargeTransactions", v)} />
            <Field label="Large Txn Threshold">
              <input type="number" value={settings.largeTransactionThreshold} onChange={e => set("largeTransactionThreshold", Number(e.target.value))} style={{ width: 120, fontSize: 12, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none" }} />
            </Field>
            <Toggle label="Reconciliation Reminders" checked={settings.notifyReconciliationDue} onChange={v => set("notifyReconciliationDue", v)} />
            <Field label="Reminder Days Before">
              <input type="number" value={settings.reconciliationReminder} onChange={e => set("reconciliationReminder", Number(e.target.value))} min={1} max={30} style={{ width: 80, fontSize: 12, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none" }} />
            </Field>
          </Section>

          <Section title="Risk & Compliance" icon={<Shield size={14} />}>
            <Field label="Min Alert Severity">
              <select value={settings.riskAlertMinSeverity} onChange={e => set("riskAlertMinSeverity", e.target.value)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Fiscal Year Start">
              <select value={settings.fiscalYearStart} onChange={e => set("fiscalYearStart", e.target.value)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                {["APRIL", "JANUARY", "JULY", "OCTOBER"].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Default Currency">
              <select value={settings.defaultCurrency} onChange={e => set("defaultCurrency", e.target.value)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                {["INR", "USD", "EUR", "GBP"].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </Section>
        </div>
      </div>

      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Settings are stored locally. Backend persistence coming soon.</p>
    </div>
  );
}
