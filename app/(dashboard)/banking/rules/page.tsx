"use client";

import { useState } from "react";
import {
  Plus, Play, Pause, Trash2, Edit2, Zap, Tag, AlertTriangle,
  CheckCircle2, X, Loader2, RefreshCw,
} from "lucide-react";
import { useQuery, useQueryClient } from "@/lib/queryCache";

interface Condition { field: string; operator: string; value: string; logic: "AND" | "OR" }
interface Action { type: string; value: string }
interface BankingRule {
  id: string; name: string; description: string | null; priority: number;
  isActive: boolean; matchCount: number; lastMatchedAt: string | null;
  conditions: Condition[]; actions: Action[]; createdAt: string;
}

const FIELDS = ["narration", "amount", "txnType", "referenceNumber", "debit", "credit", "bank"];
const OPERATORS = ["contains", "equals", "starts_with", "ends_with", "greater_than", "less_than", "regex"];
const ACTION_TYPES = ["set_category", "set_gst_category", "flag", "require_approval", "set_tag", "ignore"];
const CATEGORIES = ["Customer Receipt","Vendor Payment","GST Payment","TDS Payment","Payroll","Rent","Utilities","Bank Charges","Interest Income","Office Expense","Travel","Staff Welfare","Cloud & Software","Raw Material","Other"];

function formatTimeAgo(d: string | null) {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function RuleBuilderModal({ rule, onSave, onClose }: {
  rule: Partial<BankingRule> | null;
  onSave: (data: { name: string; description: string; priority: number; isActive: boolean; conditions: Condition[]; actions: Action[] }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [priority, setPriority] = useState(rule?.priority ?? 100);
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [conditions, setConditions] = useState<Condition[]>(rule?.conditions ?? [{ field: "narration", operator: "contains", value: "", logic: "AND" }]);
  const [actions, setActions] = useState<Action[]>(rule?.actions ?? [{ type: "set_category", value: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addCondition = () => setConditions(c => [...c, { field: "narration", operator: "contains", value: "", logic: "AND" }]);
  const removeCondition = (i: number) => setConditions(c => c.filter((_, j) => j !== i));
  const updateCondition = (i: number, k: keyof Condition, v: string) => setConditions(c => c.map((x, j) => j === i ? { ...x, [k]: v } : x));

  const addAction = () => setActions(a => [...a, { type: "set_category", value: "" }]);
  const removeAction = (i: number) => setActions(a => a.filter((_, j) => j !== i));
  const updateAction = (i: number, k: keyof Action, v: string) => setActions(a => a.map((x, j) => j === i ? { ...x, [k]: v } : x));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) { setError("Rule name is required"); return; }
    if (conditions.some(c => !c.value)) { setError("All conditions need a value"); return; }
    if (actions.some(a => !a.value)) { setError("All actions need a value"); return; }
    setSaving(true);
    try { await onSave({ name, description, priority, isActive, conditions, actions }); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to save rule"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, width: 540, maxWidth: "calc(100vw - 32px)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{rule?.id ? "Edit Rule" : "New Rule"}</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><X size={16} color="var(--text-muted)" /></button>
        </div>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Rule Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Amazon → Office Expense" style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Priority</label>
              <input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} min={1} max={999} style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} id="active" />
            <label htmlFor="active" style={{ fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>Active</label>
          </div>

          {/* Conditions */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>IF (Conditions)</p>
              <button type="button" onClick={addCondition} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "#6366f1", cursor: "pointer" }}>+ Add</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {conditions.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {i > 0 && (
                    <select value={c.logic} onChange={e => updateCondition(i, "logic", e.target.value)} style={{ width: 56, fontSize: 11, padding: "5px 4px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  )}
                  {i === 0 && <div style={{ width: 56, flexShrink: 0, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>IF</div>}
                  <select value={c.field} onChange={e => updateCondition(i, "field", e.target.value)} style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                    {FIELDS.map(f => <option key={f}>{f}</option>)}
                  </select>
                  <select value={c.operator} onChange={e => updateCondition(i, "operator", e.target.value)} style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                    {OPERATORS.map(o => <option key={o}>{o.replace("_", " ")}</option>)}
                  </select>
                  <input value={c.value} onChange={e => updateCondition(i, "value", e.target.value)} placeholder="Value" style={{ flex: 1, fontSize: 11, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none" }} />
                  {conditions.length > 1 && <button type="button" onClick={() => removeCondition(i)} style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}><X size={12} color="var(--text-muted)" /></button>}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>THEN (Actions)</p>
              <button type="button" onClick={addAction} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "#6366f1", cursor: "pointer" }}>+ Add</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {actions.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select value={a.type} onChange={e => updateAction(i, "type", e.target.value)} style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                    {ACTION_TYPES.map(t => <option key={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                  {a.type === "set_category" ? (
                    <select value={a.value} onChange={e => updateAction(i, "value", e.target.value)} style={{ flex: 1, fontSize: 11, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                      <option value="">— Select —</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input value={a.value} onChange={e => updateAction(i, "value", e.target.value)} placeholder="Value" style={{ flex: 1, fontSize: 11, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none" }} />
                  )}
                  {actions.length > 1 && <button type="button" onClick={() => removeAction(i)} style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}><X size={12} color="var(--text-muted)" /></button>}
                </div>
              ))}
            </div>
          </div>

          {error && <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 2, padding: "9px 0", borderRadius: 8, border: "none", background: "#6366f1", fontSize: 13, fontWeight: 600, color: "white", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : rule?.id ? "Update Rule" : "Create Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RulesPage() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<BankingRule | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery(
    ["banking", "rules"],
    async () => {
      const r = await fetch("/api/banking/rules");
      if (!r.ok) return { rules: [] };
      return r.json() as Promise<{ rules: BankingRule[] }>;
    },
    { staleTime: 60_000 }
  );

  const rules = data?.rules ?? [];

  const handleCreate = async (formData: { name: string; description: string; priority: number; isActive: boolean; conditions: Condition[]; actions: Action[] }) => {
    await fetch("/api/banking/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    qc.invalidate(["banking", "rules"]);
  };

  const handleUpdate = async (id: string, updates: Partial<BankingRule>) => {
    await fetch(`/api/banking/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    qc.invalidate(["banking", "rules"]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    await fetch(`/api/banking/rules/${id}`, { method: "DELETE" });
    qc.invalidate(["banking", "rules"]);
  };

  const handleApply = async (id: string) => {
    setApplyingId(id);
    try {
      await fetch("/api/banking/rules/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId: id }),
      });
      qc.invalidate(["banking", "transactions"]);
      qc.invalidate(["banking", "rules"]);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Rules Engine</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Auto-categorize and process transactions</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={async () => {
              await fetch("/api/banking/rules/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
              qc.invalidate(["banking", "transactions"]);
            }}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(99,102,241,0.08)", color: "#6366f1", cursor: "pointer", fontWeight: 600 }}>
            <Zap size={12} /> Apply All Rules
          </button>
          <button onClick={() => { setEditingRule(null); setShowBuilder(true); }} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer", fontWeight: 600 }}>
            <Plus size={12} /> New Rule
          </button>
        </div>
      </div>

      {/* Rules List */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: 88, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)", opacity: 0.4 }} />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 360, gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Tag size={28} color="#6366f1" />
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No rules yet</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 360 }}>Create rules to automatically categorize transactions, flag anomalies, and streamline reconciliation.</p>
          </div>
          <button onClick={() => { setEditingRule(null); setShowBuilder(true); }} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "10px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer" }}>
            <Plus size={14} /> Create Your First Rule
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rules.map(rule => (
            <div key={rule.id} style={{ background: "var(--bg-card)", border: `1px solid ${rule.isActive ? "var(--border)" : "rgba(100,116,139,0.3)"}`, borderRadius: 12, padding: "14px 16px", opacity: rule.isActive ? 1 : 0.65 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{rule.name}</p>
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: rule.isActive ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)", color: rule.isActive ? "#10b981" : "#64748b", fontWeight: 700 }}>
                      {rule.isActive ? "ACTIVE" : "PAUSED"}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Priority {rule.priority}</span>
                  </div>
                  {rule.description && <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{rule.description}</p>}
                  {/* Condition preview */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {rule.conditions.map((c, i) => (
                      <span key={i} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                        {i > 0 && <span style={{ color: "#6366f1", fontWeight: 600 }}>{c.logic} </span>}
                        {c.field} {c.operator.replace("_", " ")} "{c.value}"
                      </span>
                    ))}
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>→</span>
                    {rule.actions.map((a, i) => (
                      <span key={i} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(99,102,241,0.08)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
                        {a.type.replace(/_/g, " ")}: {a.value}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                    {rule.matchCount} matches · Last: {formatTimeAgo(rule.lastMatchedAt)}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => handleApply(rule.id)} disabled={applyingId === rule.id} title="Apply now" style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", color: "#6366f1" }}>
                    {applyingId === rule.id ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={11} />}
                  </button>
                  <button onClick={() => handleUpdate(rule.id, { isActive: !rule.isActive })} title={rule.isActive ? "Pause" : "Resume"} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-muted)" }}>
                    {rule.isActive ? <Pause size={11} /> : <Play size={11} />}
                  </button>
                  <button onClick={() => { setEditingRule(rule); setShowBuilder(true); }} title="Edit" style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-muted)" }}>
                    <Edit2 size={11} />
                  </button>
                  <button onClick={() => handleDelete(rule.id)} title="Delete" style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", color: "#ef4444" }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showBuilder && (
        <RuleBuilderModal
          rule={editingRule}
          onSave={editingRule ? (d) => handleUpdate(editingRule.id, d).then(() => qc.invalidate(["banking", "rules"])) : handleCreate}
          onClose={() => { setShowBuilder(false); setEditingRule(null); }}
        />
      )}
    </div>
  );
}
