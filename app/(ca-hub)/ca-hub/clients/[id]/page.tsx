"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, ShieldCheck, ReceiptText, Landmark, FileSpreadsheet, Building2,
  ClipboardCheck, Wallet, FolderLock, Activity, Phone, Mail, Users2,
  TrendingUp, ArrowRight, FileText, MessageSquare, PenLine,
} from "lucide-react";
import { demoClients, formatINR, formatINRFull, type FilingState } from "@/lib/ca-hub/demo-data";
import { FilingPill, RiskPill, PrimaryButton, GhostButton, MiniProgress, Panel } from "@/components/ca-hub/ui";

const TABS = ["Overview", "Compliance", "Banking", "Accounting", "GST", "TDS", "ITR", "Payroll", "Audit", "ROC", "Documents"] as const;
type Tab = typeof TABS[number];

const AREA_META: Record<string, { icon: typeof ShieldCheck; accent: string; href: string }> = {
  gst: { icon: ReceiptText, accent: "#f59e0b", href: "/ca-hub/gst" },
  tds: { icon: Landmark, accent: "#06b6d4", href: "/ca-hub/tds" },
  itr: { icon: FileSpreadsheet, accent: "#8b5cf6", href: "/ca-hub/income-tax" },
  roc: { icon: Building2, accent: "#f43f5e", href: "/ca-hub/roc" },
  audit: { icon: ClipboardCheck, accent: "#ec4899", href: "/ca-hub/audit" },
  payroll: { icon: Wallet, accent: "#10b981", href: "/ca-hub/clients" },
};

function healthColor(s: number) {
  if (s >= 85) return "#10b981";
  if (s >= 70) return "#f59e0b";
  return "#ef4444";
}

export default function Client360() {
  const params = useParams<{ id: string }>();
  const client = demoClients.find((c) => c.id === params.id) ?? demoClients[0];
  const [tab, setTab] = useState<Tab>("Overview");
  const hc = healthColor(client.healthScore);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }} className="animate-fade-in">
      {/* Back */}
      <Link href="/ca-hub/clients" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none", width: "fit-content" }}>
        <ArrowLeft size={14} /> Client Portfolio
      </Link>

      {/* Client header card */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 22, display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 14, flexShrink: 0, background: "linear-gradient(135deg,#6366f1,#0ea5e9)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>
            {client.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)" }}>{client.name}</h1>
              <RiskPill level={client.risk} />
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>
              {client.type} · GSTIN {client.gstin ?? "—"} · PAN {client.pan}
            </p>
            <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}><Users2 size={13} /> {client.partner}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}><Phone size={13} /> +91 98xxxxxx</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}><Mail size={13} /> accounts@client.in</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Health Score</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, justifyContent: "flex-end" }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: hc }}>{client.healthScore}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/100</span>
            </div>
            <div style={{ width: 120, marginTop: 4 }}><MiniProgress value={client.healthScore} color={hc} /></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <GhostButton icon={MessageSquare}>Message</GhostButton>
            <PrimaryButton icon={PenLine}>New Task</PrimaryButton>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              fontSize: 13, fontWeight: 600, padding: "10px 14px", border: "none", cursor: "pointer",
              background: "transparent", whiteSpace: "nowrap",
              color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "Overview" ? <OverviewTab client={client} /> : tab === "Compliance" ? <ComplianceTab client={client} /> : tab === "Banking" ? <BankingTab client={client} /> : <AreaTab tab={tab} client={client} />}
    </div>
  );
}

function OverviewTab({ client }: { client: typeof demoClients[number] }) {
  const areas = Object.entries(client.compliance) as [keyof typeof client.compliance, FilingState][];
  return (
    <>
      {/* Compliance matrix cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
        {areas.map(([key, state]) => {
          const meta = AREA_META[key];
          const Icon = meta?.icon ?? ShieldCheck;
          return (
            <div key={key} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 15 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${meta?.accent ?? "#6366f1"}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={15} color={meta?.accent ?? "#6366f1"} />
                </div>
                <FilingPill state={state} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{key}</p>
              <Link href={meta?.href ?? "#"} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#6366f1", textDecoration: "none", marginTop: 6 }}>
                Open module <ArrowRight size={11} />
              </Link>
            </div>
          );
        })}
      </div>

      {/* Two-column: financials + activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel title="Key Financials" subtitle="FY 2025-26 (provisional)">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Turnover", value: formatINR(client.monthlyFee * 280), icon: TrendingUp, color: "#10b981" },
              { label: "Net Profit", value: formatINR(client.monthlyFee * 42), icon: Activity, color: "#6366f1" },
              { label: "GST Liability (YTD)", value: formatINR(client.monthlyFee * 31), icon: ReceiptText, color: "#f59e0b" },
              { label: "Recurring Fee", value: `${formatINRFull(client.monthlyFee)}/mo`, icon: Wallet, color: "#0ea5e9" },
            ].map((r) => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${r.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <r.icon size={16} color={r.color} />
                </div>
                <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1 }}>{r.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{r.value}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recent Activity" subtitle="Audit trail across this engagement">
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { who: client.manager, what: "filed GSTR-3B for May 2026", when: "2h ago", color: "#10b981" },
              { who: "Karan Patel", what: "uploaded bank statements (HDFC)", when: "Yesterday", color: "#6366f1" },
              { who: client.partner, what: "approved TDS 26Q working", when: "2d ago", color: "#06b6d4" },
              { who: "System", what: "reminder sent — PF challan due", when: "3d ago", color: "#f59e0b" },
              { who: client.manager, what: "added FY26 audit planning memo", when: "5d ago", color: "#ec4899" },
            ].map((a, i, arr) => (
              <div key={i} style={{ display: "flex", gap: 11, paddingBottom: i < arr.length - 1 ? 12 : 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: a.color, marginTop: 4 }} />
                  {i < arr.length - 1 && <span style={{ width: 1, flex: 1, background: "var(--border)", marginTop: 3 }} />}
                </div>
                <div style={{ paddingBottom: 4 }}>
                  <p style={{ fontSize: 12.5, color: "var(--text-primary)" }}><b>{a.who}</b> {a.what}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{a.when}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function ComplianceTab({ client }: { client: typeof demoClients[number] }) {
  const rows = [
    { obligation: "GSTR-1 (May 2026)", due: "11 Jun 2026", state: client.compliance.gst, period: "Monthly" },
    { obligation: "GSTR-3B (May 2026)", due: "20 Jun 2026", state: client.compliance.gst, period: "Monthly" },
    { obligation: "TDS 26Q (Q1 FY26-27)", due: "31 Jul 2026", state: client.compliance.tds, period: "Quarterly" },
    { obligation: "ITR (AY 2026-27)", due: "31 Jul 2026", state: client.compliance.itr, period: "Annual" },
    { obligation: "Tax Audit 3CD", due: "30 Sep 2026", state: client.compliance.audit, period: "Annual" },
    { obligation: "AOC-4 / MGT-7", due: "30 Oct 2026", state: client.compliance.roc, period: "Annual" },
    { obligation: "PF & ESI Challan", due: "15 Jun 2026", state: client.compliance.payroll, period: "Monthly" },
  ];
  return (
    <Panel title="Compliance Ledger" subtitle="Every statutory obligation for this client">
      <div className="table-wrapper" style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%" }}>
          <thead><tr><th>Obligation</th><th>Frequency</th><th>Due Date</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.obligation}>
                <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.obligation}</td>
                <td>{r.period}</td>
                <td>{r.due}</td>
                <td><FilingPill state={r.state} /></td>
                <td><Link href="/ca-hub/compliance" style={{ fontSize: 12, color: "#6366f1", textDecoration: "none" }}>View →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// Banking access runs through the Client Workspace: the signed workspace
// session scopes every /banking page + API to the client org, gated by
// the ClientAssignment's MANAGE_BANKING permission. Consent creation /
// revocation / disconnection additionally require the explicit
// MANAGE_CONSENTS grant — enforced server-side in the consent routes.
function BankingTab({ client }: { client: typeof demoClients[number] }) {
  const capabilities = [
    { label: "View accounts & balances", granted: true },
    { label: "View transactions", granted: true },
    { label: "Run reconciliation", granted: true },
    { label: "Create categorization rules", granted: true },
    { label: "Generate banking reports", granted: true },
    { label: "Create / revoke AA consents", granted: false },
    { label: "Disconnect bank accounts", granted: false },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Panel title="Live Banking Workspace" subtitle="Account Aggregator-powered client banking">
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
          Open the client workspace to work with <b>{client.name}</b>&apos;s live bank data —
          connected accounts, balance history, AA-synced transactions, reconciliation
          sessions, rules and cash-flow analytics. Every action is audit-logged against
          your CA account.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {capabilities.map((cap) => (
            <div key={cap.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: cap.granted ? "#10b981" : "#ef4444", flexShrink: 0 }} />
              <span style={{ color: "var(--text-secondary)", flex: 1 }}>{cap.label}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: cap.granted ? "#10b981" : "#ef4444" }}>
                {cap.granted ? "INCLUDED" : "OWNER / EXPLICIT GRANT"}
              </span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.5 }}>
          Consent lifecycle actions stay with the customer unless your assignment
          includes the <b>Bank Consents</b> permission.
        </p>
      </Panel>
      <Panel title="Banking Modules" subtitle="Available inside the client workspace">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            ["Banking Dashboard", "/banking/dashboard"],
            ["Transactions", "/banking/transactions"],
            ["Reconciliation", "/banking/reconciliation"],
            ["Rules Engine", "/banking/rules"],
            ["Cash Flow Analytics", "/banking/cash-flow"],
            ["Sync History", "/banking/sync-history"],
          ].map(([label, href]) => (
            <div key={href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 9, border: "1px solid var(--border)" }}>
              <Landmark size={15} color="var(--text-muted)" />
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)", flex: 1 }}>{label}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{href}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 12 }}>
          Enter via <b>Client Portfolio → Open Workspace</b> — the workspace banner keeps
          you aware you&apos;re acting on the client&apos;s organization.
        </p>
      </Panel>
    </div>
  );
}

function AreaTab({ tab, client }: { tab: Tab; client: typeof demoClients[number] }) {
  const key = tab.toLowerCase() as keyof typeof client.compliance;
  const state = (client.compliance[key] ?? "NA") as FilingState;
  const meta = AREA_META[key] ?? { icon: FolderLock, accent: "#6366f1", href: "/ca-hub" };
  const Icon = meta.icon;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `${meta.accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={20} color={meta.accent} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{tab}</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Current cycle status</p>
          </div>
          <div style={{ marginLeft: "auto" }}><FilingPill state={state} /></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            ["Last filed", "20 May 2026"],
            ["Next due", client.nextDue.date],
            ["Assigned to", client.manager],
            ["Documents", "8 attached"],
          ].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>{l}</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <Link href={meta.href} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: meta.accent, textDecoration: "none", marginTop: 16 }}>
          Open {tab} module <ArrowRight size={14} />
        </Link>
      </Panel>
      <Panel title="Linked Documents" subtitle={`${tab} working papers & filings`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {["Computation sheet.xlsx", "Acknowledgement.pdf", "Supporting ledger.pdf", "Reconciliation.xlsx"].map((d) => (
            <div key={d} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 9, border: "1px solid var(--border)" }}>
              <FileText size={15} color="var(--text-muted)" />
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)", flex: 1 }}>{d}</span>
              <ArrowRight size={13} color="var(--text-muted)" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
