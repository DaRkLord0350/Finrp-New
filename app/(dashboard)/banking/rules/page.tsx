"use client";

import { useState } from "react";
import { Plus, Wand2, Play, Pause, Trash2, Edit2, ChevronDown, ChevronRight, Zap, Tag, AlertTriangle, CheckCircle2, X, GripVertical } from "lucide-react";

interface Rule {
  id: string; name: string; description: string; priority: number;
  isActive: boolean; matchCount: number; lastMatchedAt: string | null;
  conditions: Condition[]; actions: Action[];
}
interface Condition {
  id: string; field: string; operator: string; value: string; logic: "AND" | "OR";
}
interface Action {
  id: string; type: string; value: string;
}

const FIELDS = ["narration", "amount", "txnType", "bank", "referenceNumber", "debit", "credit"];
const OPERATORS = ["contains", "equals", "starts_with", "ends_with", "greater_than", "less_than", "regex"];
const ACTION_TYPES = ["set_category", "set_gst_category", "flag", "require_approval", "set_tag", "ignore"];
const CATEGORIES = ["Customer Receipt","Vendor Payment","GST Payment","TDS Payment","Payroll","Rent","Utilities","Bank Charges","Interest Income","Office Expense","Travel","Staff Welfare","Cloud & Software","Raw Material","Other"];

const MOCK_RULES: Rule[] = [
  { id: "r1", name: "Amazon → Office Expense", description: "All Amazon transactions categorized as Office Expense", priority: 10, isActive: true, matchCount: 48, lastMatchedAt: "2 hrs ago", conditions: [{ id: "c1", field: "narration", operator: "contains", value: "AMAZON", logic: "AND" }], actions: [{ id: "a1", type: "set_category", value: "Office Expense" }] },
  { id: "r2", name: "Swiggy/Zomato → Staff Welfare", description: "Food delivery platforms for staff welfare", priority: 20, isActive: true, matchCount: 124, lastMatchedAt: "1 hr ago", conditions: [{ id: "c1", field: "narration", operator: "contains", value: "SWIGGY", logic: "AND" }, { id: "c2", field: "narration", operator: "contains", value: "ZOMATO", logic: "OR" }], actions: [{ id: "a1", type: "set_category", value: "Staff Welfare" }] },
  { id: "r3", name: "GST Payment Detection", description: "Auto-detect GST payments from narration", priority: 5, isActive: true, matchCount: 12, lastMatchedAt: "3 days ago", conditions: [{ id: "c1", field: "narration", operator: "contains", value: "GST", logic: "AND" }], actions: [{ id: "a1", type: "set_category", value: "GST Payment" }, { id: "a2", type: "set_gst_category", value: "GST_PAYMENT" }] },
  { id: "r4", name: "Large Withdrawal Alert", description: "Flag any debit > ₹5L for review", priority: 1, isActive: true, matchCount: 8, lastMatchedAt: "1 week ago", conditions: [{ id: "c1", field: "debit", operator: "greater_than", value: "500000", logic: "AND" }], actions: [{ id: "a1", type: "flag", value: "LARGE_AMOUNT" }, { id: "a2", type: "require_approval", value: "true" }] },
  { id: "r5", name: "Salary/Payroll Detection", description: "Detect payroll disbursements", priority: 15, isActive: false, matchCount: 6, lastMatchedAt: "1 month ago", conditions: [{ id: "c1", field: "narration", operator: "contains", value: "SALARY", logic: "AND" }, { id: "c2", field: "narration", operator: "contains", value: "PAYROLL", logic: "OR" }], actions: [{ id: "a1", type: "set_category", value: "Payroll" }] },
];

const ACTION_TYPE_LABELS: Record<string, string> = {
  set_category: "Set Category", set_gst_category: "Set GST Category",
  flag: "Flag Transaction", require_approval: "Require Approval",
  set_tag: "Add Tag", ignore: "Ignore",
};

export default function RulesEnginePage() {
  const [rules, setRules] = useState<Rule[]>(MOCK_RULES);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const toggleActive = (id: string) => {
    setRules(r => r.map(rule => rule.id === id ? { ...rule, isActive: !rule.isActive } : rule));
  };

  const activeCount = rules.filter(r => r.isActive).length;
  const totalMatches = rules.reduce((s, r) => s + r.matchCount, 0);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Rules Engine</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Auto-categorize transactions with intelligent rules</p>
        </div>
        <button onClick={() => { setEditingRule(null); setShowBuilder(true); }} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer", fontWeight: 600 }}>
          <Plus size={12} /> New Rule
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          ["Total Rules", rules.length, "#6366f1", <Wand2 size={14} color="#6366f1" />],
          ["Active Rules", activeCount, "#10b981", <CheckCircle2 size={14} color="#10b981" />],
          ["Total Matches", totalMatches.toLocaleString(), "#f59e0b", <Zap size={14} color="#f59e0b" />],
          ["Inactive", rules.length - activeCount, "#ef4444", <Pause size={14} color="#ef4444" />],
        ].map(([label, value, color, icon]) => (
          <div key={String(label)} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon as React.ReactNode}</div>
            <div>
              <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>{label as string}</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: String(color) }}>{value as React.ReactNode}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Rules List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rules.sort((a, b) => a.priority - b.priority).map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            expanded={expandedRule === rule.id}
            onExpand={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
            onToggle={() => toggleActive(rule.id)}
            onEdit={() => { setEditingRule(rule); setShowBuilder(true); }}
            onDelete={() => setRules(r => r.filter(x => x.id !== rule.id))}
          />
        ))}
      </div>

      {/* Rule Builder Modal */}
      {showBuilder && (
        <RuleBuilderModal
          rule={editingRule}
          onClose={() => setShowBuilder(false)}
          onSave={(r) => {
            if (editingRule) {
              setRules(prev => prev.map(x => x.id === r.id ? r : x));
            } else {
              setRules(prev => [...prev, { ...r, id: `r${Date.now()}`, matchCount: 0, lastMatchedAt: null }]);
            }
            setShowBuilder(false);
          }}
        />
      )}
    </div>
  );
}

function RuleCard({ rule, expanded, onExpand, onToggle, onEdit, onDelete }: {
  rule: Rule; expanded: boolean;
  onExpand: () => void; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", opacity: rule.isActive ? 1 : 0.7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }} onClick={onExpand}>
        <GripVertical size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <div style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#6366f1" }}>#{rule.priority}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{rule.name}</p>
            {!rule.isActive && <span style={{ fontSize: 9, color: "#64748b", background: "rgba(100,116,139,0.1)", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>INACTIVE</span>}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{rule.description}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{rule.matchCount.toLocaleString()}</p>
            <p style={{ fontSize: 10, color: "var(--text-muted)" }}>matches</p>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", color: "var(--text-secondary)" }}><Edit2 size={11} /></button>
            <button onClick={(e) => { e.stopPropagation(); onToggle(); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", color: rule.isActive ? "#10b981" : "var(--text-muted)" }}>
              {rule.isActive ? <CheckCircle2 size={11} /> : <Play size={11} />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)", background: "var(--bg-card)", cursor: "pointer", color: "#ef4444" }}><Trash2 size={11} /></button>
          </div>
          {expanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "12px 14px 14px", borderTop: "1px solid var(--border)", background: "var(--bg-hover)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Conditions (IF)</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {rule.conditions.map((c, i) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {i > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", minWidth: 28 }}>{c.logic}</span>}
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "var(--text-secondary)", display: "flex", gap: 4 }}>
                    <span style={{ color: "#06b6d4", fontWeight: 600 }}>{c.field}</span>
                    <span style={{ color: "var(--text-muted)" }}>{c.operator}</span>
                    <span style={{ color: "#f59e0b", fontWeight: 600 }}>"{c.value}"</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Actions (THEN)</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {rule.actions.map((a) => (
                <div key={a.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "var(--text-secondary)", display: "flex", gap: 4 }}>
                  <Tag size={10} color="#10b981" />
                  <span style={{ color: "var(--text-muted)" }}>{ACTION_TYPE_LABELS[a.type] ?? a.type}</span>
                  <span style={{ color: "#10b981", fontWeight: 600 }}>→ {a.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RuleBuilderModal({ rule, onClose, onSave }: {
  rule: Rule | null;
  onClose: () => void;
  onSave: (r: Rule) => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [priority, setPriority] = useState(rule?.priority ?? 100);
  const [conditions, setConditions] = useState<Condition[]>(rule?.conditions ?? [{ id: "c1", field: "narration", operator: "contains", value: "", logic: "AND" }]);
  const [actions, setActions] = useState<Action[]>(rule?.actions ?? [{ id: "a1", type: "set_category", value: "" }]);

  const addCondition = () => setConditions(c => [...c, { id: `c${Date.now()}`, field: "narration", operator: "contains", value: "", logic: "AND" }]);
  const addAction = () => setActions(a => [...a, { id: `a${Date.now()}`, type: "set_category", value: "" }]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ id: rule?.id ?? `r${Date.now()}`, name, description, priority, isActive: rule?.isActive ?? true, matchCount: rule?.matchCount ?? 0, lastMatchedAt: rule?.lastMatchedAt ?? null, conditions, actions });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "auto", border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{rule ? "Edit Rule" : "Create New Rule"}</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><X size={16} color="var(--text-muted)" /></button>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>RULE NAME</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Amazon → Office Expense" style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>DESCRIPTION</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>PRIORITY</label>
              <input type="number" value={priority} onChange={e => setPriority(+e.target.value)} style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>IF (Conditions)</p>
              <button onClick={addCondition} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "#6366f1", cursor: "pointer" }}><Plus size={10} style={{ display: "inline" }} /> Add</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {conditions.map((c, i) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {i > 0 ? (
                    <select value={c.logic} onChange={e => setConditions(prev => prev.map((x, j) => j === i ? { ...x, logic: e.target.value as "AND" | "OR" } : x))} style={{ fontSize: 11, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "rgba(99,102,241,0.08)", color: "#818cf8", cursor: "pointer", width: 60, fontWeight: 600 }}>
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  ) : <div style={{ width: 60 }} />}
                  <select value={c.field} onChange={e => setConditions(prev => prev.map((x, j) => j === i ? { ...x, field: e.target.value } : x))} style={{ flex: 1, fontSize: 12, padding: "7px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                    {FIELDS.map(f => <option key={f}>{f}</option>)}
                  </select>
                  <select value={c.operator} onChange={e => setConditions(prev => prev.map((x, j) => j === i ? { ...x, operator: e.target.value } : x))} style={{ flex: 1, fontSize: 12, padding: "7px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                    {OPERATORS.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <input value={c.value} onChange={e => setConditions(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="value..." style={{ flex: 2, fontSize: 12, padding: "7px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none" }} />
                  {conditions.length > 1 && (
                    <button onClick={() => setConditions(c => c.filter((_, j) => j !== i))} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><X size={12} color="var(--text-muted)" /></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>THEN (Actions)</p>
              <button onClick={addAction} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "#10b981", cursor: "pointer" }}><Plus size={10} style={{ display: "inline" }} /> Add</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {actions.map((a, i) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Tag size={12} color="#10b981" />
                  <select value={a.type} onChange={e => setActions(prev => prev.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} style={{ flex: 1, fontSize: 12, padding: "7px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                    {ACTION_TYPES.map(t => <option key={t} value={t}>{ACTION_TYPE_LABELS[t] ?? t}</option>)}
                  </select>
                  {a.type === "set_category" ? (
                    <select value={a.value} onChange={e => setActions(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} style={{ flex: 2, fontSize: 12, padding: "7px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input value={a.value} onChange={e => setActions(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="value..." style={{ flex: 2, fontSize: 12, padding: "7px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", outline: "none" }} />
                  )}
                  {actions.length > 1 && (
                    <button onClick={() => setActions(a => a.filter((_, j) => j !== i))} style={{ border: "none", background: "none", cursor: "pointer", padding: 4 }}><X size={12} color="var(--text-muted)" /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#6366f1", fontSize: 13, color: "white", cursor: "pointer", fontWeight: 600, opacity: name.trim() ? 1 : 0.5 }}>
            {rule ? "Update Rule" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}
