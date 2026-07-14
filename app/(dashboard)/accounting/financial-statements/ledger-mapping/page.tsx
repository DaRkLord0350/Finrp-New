"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Save, Sparkles, ChevronRight, ChevronDown, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";

type TemplateId = "builtin-corporate-balance_sheet" | "builtin-corporate-profit_loss" | "builtin-corporate-cash_flow";

interface AccountMapping {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  balance: number;
  scheduleKey: string | null;
  scheduleLabel: string | null;
  confidence: number | null;
  mappingId: string | null;
  aiSuggested: boolean;
}

interface ScheduleNode {
  key: string;
  label: string;
  section: string;
  children?: ScheduleNode[];
}

interface MappingsResponse {
  accounts: AccountMapping[];
  scheduleTree: ScheduleNode[];
  unmappedCount: number;
  templateId: string;
}

const TEMPLATE_OPTIONS: { value: TemplateId; label: string }[] = [
  { value: "builtin-corporate-balance_sheet", label: "Balance Sheet (Schedule III)" },
  { value: "builtin-corporate-profit_loss",   label: "Profit & Loss (Schedule III)" },
  { value: "builtin-corporate-cash_flow",     label: "Cash Flow Statement" },
];

function confidenceLabel(c: number | null): { label: string; color: string } {
  if (c === null) return { label: "—", color: "var(--text-muted)" };
  if (c >= 0.8)   return { label: "High",   color: "#10b981" };
  if (c >= 0.5)   return { label: "Medium", color: "#f59e0b" };
  return                  { label: "Low",    color: "#ef4444" };
}

function flattenTree(nodes: ScheduleNode[]): ScheduleNode[] {
  return nodes.flatMap((n) => [n, ...(n.children ? flattenTree(n.children) : [])]);
}

export default function LedgerMappingPage() {
  const [templateId, setTemplateId] = useState<TemplateId>("builtin-corporate-balance_sheet");
  const [data, setData] = useState<MappingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiRunning, setAiRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Selected account for inline editing
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string>("");

  // Tree expand state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Pending changes: accountId → scheduleKey
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/financial-statements/mappings?templateId=${encodeURIComponent(templateId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load mappings");
      setData(json);
      // Auto-expand top-level sections
      const topSections = (json.scheduleTree ?? []).map((n: ScheduleNode) => n.key);
      setExpandedSections(new Set(topSections));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => { load(); }, [load]);

  const runAI = async () => {
    setAiRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/financial-statements/mappings/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, templateCategory: "CORPORATE", statementType: "BALANCE_SHEET" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "AI mapping failed");
      setSuccess(`AI mapped ${json.mapped ?? 0} accounts. Review suggestions below.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI mapping failed");
    } finally {
      setAiRunning(false);
    }
  };

  const saveAll = async () => {
    if (Object.keys(pendingChanges).length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const entries = Object.entries(pendingChanges).map(([accountId, scheduleKey]) => ({ accountId, scheduleKey, templateId }));
      const res = await fetch("/api/financial-statements/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: entries }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setPendingChanges({});
      setSelectedId(null);
      setSuccess(`Saved ${entries.length} mapping(s).`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const applyEdit = (accountId: string) => {
    if (!editKey) return;
    setPendingChanges((prev) => ({ ...prev, [accountId]: editKey }));
    setSelectedId(null);
    setEditKey("");
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allScheduleNodes = data ? flattenTree(data.scheduleTree) : [];
  const sectionGroups = data
    ? [...new Set(allScheduleNodes.map((n) => n.section))].filter(Boolean)
    : [];

  const accounts = data?.accounts ?? [];
  const pendingCount = Object.keys(pendingChanges).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>AI Ledger Mapping</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
            Map chart-of-accounts lines to Schedule III positions. AI suggests; you confirm.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value as TemplateId)}
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
          >
            {TEMPLATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={load} className="btn-ghost" style={{ padding: "8px 12px" }}>
            <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
          <button onClick={runAI} disabled={aiRunning} className="btn-ghost"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", opacity: aiRunning ? 0.7 : 1 }}>
            <Sparkles size={14} color="#a78bfa" />
            {aiRunning ? "AI Running…" : "Run AI Mapping"}
          </button>
          <button onClick={saveAll} disabled={saving || pendingCount === 0} className="btn-brand"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", opacity: (saving || pendingCount === 0) ? 0.6 : 1 }}>
            <Save size={14} />
            {saving ? "Saving…" : `Save All${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, padding: "10px 14px", color: "#10b981", fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={14} /> {success}
          <button onClick={() => setSuccess(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#10b981", cursor: "pointer" }}><X size={13} /></button>
        </div>
      )}

      {aiRunning && (
        <div style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#a78bfa", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 16, height: 16, border: "2px solid rgba(167,139,250,0.3)", borderTopColor: "#a78bfa", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
          AI is analysing your chart of accounts and suggesting Schedule III mappings…
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Total Accounts", value: accounts.length, color: "#6366f1" },
          { label: "Mapped",         value: accounts.filter((a) => (pendingChanges[a.accountId] ?? a.scheduleKey) !== null).length, color: "#10b981" },
          { label: "Unmapped",       value: data?.unmappedCount ?? 0, color: "#f59e0b" },
          { label: "Pending Changes",value: pendingCount, color: "#3b82f6" },
        ].map((s) => (
          <div key={s.label} className="surface" style={{ padding: "12px 16px", minWidth: 130 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4 }}>{loading ? "…" : s.value}</p>
          </div>
        ))}
      </div>

      {/* Two-panel layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
        {/* Left: Account list */}
        <motion.div className="surface" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Accounts</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Click a row to change its Schedule III mapping</p>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg-elevated)" }}>
                    {["Code", "Name", "Type", "Balance", "Schedule Key", "Confidence"].map((h, i) => (
                      <th key={h} style={{ padding: "9px 14px", fontWeight: 600, fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i >= 3 ? "right" : "left" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>No accounts found for this template.</td></tr>
                  )}
                  {accounts.map((acc) => {
                    const effectiveKey = pendingChanges[acc.accountId] ?? acc.scheduleKey;
                    const effectiveLabel = effectiveKey
                      ? allScheduleNodes.find((n) => n.key === effectiveKey)?.label ?? effectiveKey
                      : null;
                    const conf = confidenceLabel(acc.confidence);
                    const isPending = acc.accountId in pendingChanges;
                    const isSelected = selectedId === acc.accountId;

                    return [
                      <tr key={acc.accountId} className="row-hover"
                        style={{ borderTop: "1px solid var(--border)", cursor: "pointer", background: isSelected ? "var(--bg-elevated)" : undefined }}
                        onClick={() => {
                          if (isSelected) { setSelectedId(null); setEditKey(""); }
                          else { setSelectedId(acc.accountId); setEditKey(effectiveKey ?? ""); }
                        }}
                      >
                        <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>{acc.accountCode}</td>
                        <td style={{ padding: "10px 14px", color: "var(--text-primary)", fontWeight: 500, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {acc.accountName}
                          {isPending && <span style={{ fontSize: 10, color: "#3b82f6", marginLeft: 6, fontWeight: 700 }}>●</span>}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ fontSize: 11, color: "#6366f1", background: "rgba(99,102,241,0.1)", padding: "2px 6px", borderRadius: 5 }}>{acc.accountType}</span>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "var(--text-secondary)" }}>{formatCurrency(acc.balance)}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          {effectiveKey ? (
                            <span style={{ fontSize: 11, color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "2px 7px", borderRadius: 5, fontWeight: 500, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", display: "inline-block" }}>
                              {effectiveLabel ?? effectiveKey}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "2px 7px", borderRadius: 5 }}>Unmapped</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: conf.color }}>{conf.label}</span>
                        </td>
                      </tr>,
                      isSelected && (
                        <tr key={`edit-${acc.accountId}`} style={{ borderTop: "none", background: "var(--bg-elevated)" }}>
                          <td colSpan={6} style={{ padding: "8px 14px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <select
                                value={editKey}
                                onChange={(e) => setEditKey(e.target.value)}
                                style={{ flex: 1, background: "var(--bg-card)", border: "1px solid var(--border-strong)", borderRadius: 7, color: "var(--text-primary)", padding: "7px 10px", fontSize: 13 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value="">— No Mapping —</option>
                                {sectionGroups.map((section) => (
                                  <optgroup key={section} label={section}>
                                    {allScheduleNodes.filter((n) => n.section === section && !n.children?.length).map((n) => (
                                      <option key={n.key} value={n.key}>{n.label}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                              <button onClick={(e) => { e.stopPropagation(); applyEdit(acc.accountId); }} className="btn-brand" style={{ padding: "7px 14px", fontSize: 12 }}>
                                Apply
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedId(null); setEditKey(""); }} className="btn-ghost" style={{ padding: "7px 10px" }}>
                                <X size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Right: Schedule III tree */}
        <div className="surface" style={{ overflow: "hidden", alignSelf: "start", position: "sticky", top: 20 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Schedule III Structure</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Available mapping positions</p>
          </div>
          <div style={{ maxHeight: 520, overflowY: "auto", padding: "8px 0" }}>
            {loading ? (
              <p style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
            ) : data?.scheduleTree.length === 0 ? (
              <p style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>No schedule structure for this template.</p>
            ) : (
              <TreeNodes nodes={data?.scheduleTree ?? []} expanded={expandedSections} onToggle={toggleSection} depth={0} />
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .row-hover:hover { background: var(--bg-elevated); }
      `}</style>
    </div>
  );
}

function TreeNodes({ nodes, expanded, onToggle, depth }: {
  nodes: ScheduleNode[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  depth: number;
}) {
  return (
    <>
      {nodes.map((node) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expanded.has(node.key);
        return (
          <div key={node.key}>
            <div
              style={{ padding: `6px 16px 6px ${16 + depth * 14}px`, display: "flex", alignItems: "center", gap: 6, cursor: hasChildren ? "pointer" : "default" }}
              onClick={() => hasChildren && onToggle(node.key)}
              className={hasChildren ? "row-hover" : undefined}
            >
              {hasChildren
                ? (isExpanded ? <ChevronDown size={12} color="var(--text-muted)" /> : <ChevronRight size={12} color="var(--text-muted)" />)
                : <div style={{ width: 12 }} />}
              <span style={{ fontSize: depth === 0 ? 12 : 11, fontWeight: depth === 0 ? 600 : 400, color: depth === 0 ? "var(--text-primary)" : "var(--text-secondary)" }}>
                {node.label}
              </span>
            </div>
            {hasChildren && isExpanded && (
              <TreeNodes nodes={node.children!} expanded={expanded} onToggle={onToggle} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </>
  );
}
