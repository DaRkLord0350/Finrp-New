"use client";

import { useState } from "react";
import { Settings2, Bell, Shield, RefreshCw, Tag, Palette, Save, CheckCircle2 } from "lucide-react";

export default function BankingSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    autoSync: true, syncFrequency: "HOURLY", autoCategorizaion: true, duplicateDetection: true,
    notifyConsentExpiry: true, notifyLargeTransactions: true, largeTransactionThreshold: 500000,
    notifyReconciliationDue: true, defaultCurrency: "INR", fiscalYearStart: "APRIL",
    reconciliationReminder: 7, riskAlertMinSeverity: "MEDIUM",
    aiInsightsEnabled: true, gstMatchEnabled: true,
  });

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Banking Settings</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Configure sync, notifications, categorization, and risk preferences</p>
        </div>
        <button onClick={save} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "8px 16px", borderRadius: 8, border: "none", background: saved ? "#10b981" : "#6366f1", color: "white", cursor: "pointer", fontWeight: 600, transition: "background 0.2s" }}>
          {saved ? <><CheckCircle2 size={13} /> Saved!</> : <><Save size={13} /> Save Changes</>}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Sync Settings */}
        <Section title="Sync & Automation" icon={<RefreshCw size={14} />}>
          <Toggle label="Auto Sync" desc="Automatically sync all connected accounts" checked={settings.autoSync} onChange={v => setSettings(s => ({ ...s, autoSync: v }))} />
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>SYNC FREQUENCY</label>
            <select value={settings.syncFrequency} onChange={e => setSettings(s => ({ ...s, syncFrequency: e.target.value }))} style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
              <option value="REALTIME">Real-time (AA)</option>
              <option value="HOURLY">Every hour</option>
              <option value="DAILY">Once daily</option>
              <option value="MANUAL">Manual only</option>
            </select>
          </div>
          <Toggle label="Auto-Categorization" desc="Apply rules engine to new transactions automatically" checked={settings.autoCategorizaion} onChange={v => setSettings(s => ({ ...s, autoCategorizaion: v }))} />
          <Toggle label="Duplicate Detection" desc="Flag potential duplicate transactions for review" checked={settings.duplicateDetection} onChange={v => setSettings(s => ({ ...s, duplicateDetection: v }))} />
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon={<Bell size={14} />}>
          <Toggle label="Consent Expiry Alerts" desc="Alert 30, 14, and 7 days before consent expiry" checked={settings.notifyConsentExpiry} onChange={v => setSettings(s => ({ ...s, notifyConsentExpiry: v }))} />
          <Toggle label="Large Transaction Alerts" desc="Notify on transactions above threshold" checked={settings.notifyLargeTransactions} onChange={v => setSettings(s => ({ ...s, notifyLargeTransactions: v }))} />
          {settings.notifyLargeTransactions && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>THRESHOLD AMOUNT (₹)</label>
              <input type="number" value={settings.largeTransactionThreshold} onChange={e => setSettings(s => ({ ...s, largeTransactionThreshold: +e.target.value }))} style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} />
            </div>
          )}
          <Toggle label="Reconciliation Reminders" desc="Remind if reconciliation not done after N days" checked={settings.notifyReconciliationDue} onChange={v => setSettings(s => ({ ...s, notifyReconciliationDue: v }))} />
        </Section>

        {/* Risk Settings */}
        <Section title="Risk & Fraud" icon={<Shield size={14} />}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>MINIMUM ALERT SEVERITY</label>
            <select value={settings.riskAlertMinSeverity} onChange={e => setSettings(s => ({ ...s, riskAlertMinSeverity: e.target.value }))} style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
              <option value="LOW">Low (all alerts)</option>
              <option value="MEDIUM">Medium and above</option>
              <option value="HIGH">High and Critical only</option>
              <option value="CRITICAL">Critical only</option>
            </select>
          </div>
          <Toggle label="AI Insights" desc="Enable AI-powered financial insights panel" checked={settings.aiInsightsEnabled} onChange={v => setSettings(s => ({ ...s, aiInsightsEnabled: v }))} />
          <Toggle label="GST Match Center" desc="Enable automatic GST return reconciliation" checked={settings.gstMatchEnabled} onChange={v => setSettings(s => ({ ...s, gstMatchEnabled: v }))} />
        </Section>

        {/* General */}
        <Section title="General" icon={<Settings2 size={14} />}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>DEFAULT CURRENCY</label>
            <select value={settings.defaultCurrency} onChange={e => setSettings(s => ({ ...s, defaultCurrency: e.target.value }))} style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
              <option value="INR">INR — Indian Rupee</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>FISCAL YEAR START</label>
            <select value={settings.fiscalYearStart} onChange={e => setSettings(s => ({ ...s, fiscalYearStart: e.target.value }))} style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
              <option value="APRIL">April (India)</option>
              <option value="JANUARY">January</option>
              <option value="JULY">July</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>RECONCILIATION REMINDER (DAYS)</label>
            <input type="number" value={settings.reconciliationReminder} onChange={e => setSettings(s => ({ ...s, reconciliationReminder: +e.target.value }))} min={1} max={30} style={{ width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} />
            <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>Alert if reconciliation not completed within this many days</p>
          </div>
        </Section>
      </div>
    </div>
  );
}
