"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Plus,
  RefreshCw,
  ChevronRight,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Tag,
  Layers,
  MoreVertical,
  Sparkles,
  GripVertical,
} from "lucide-react";
import {
  useComplianceCategories,
  useComplianceTypes,
} from "@/hooks/useComplianceCategories";
import type {
  ComplianceCategoryRecord,
  ComplianceTypeRecord,
  CreateComplianceCategoryInput,
  UpdateComplianceCategoryInput,
  CreateComplianceTypeInput,
} from "@/types/compliance";

// ── Colour palette for quick selection ────────────────────────
const COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

const ICONS = ["📋", "💼", "🏛️", "💰", "👥", "🔖", "📊", "⚖️", "🏢", "🔒", "📝", "✅"];

// ── Category Form Modal ────────────────────────────────────────
function CategoryFormModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: ComplianceCategoryRecord;
  onClose: () => void;
  onSubmit: (data: CreateComplianceCategoryInput | UpdateComplianceCategoryInput) => Promise<void>;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    code: initial?.code ?? "",
    color: initial?.color ?? COLORS[0],
    icon: initial?.icon ?? "📋",
    sortOrder: initial?.sortOrder ?? 0,
    isActive: initial?.isActive ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!isEdit && !form.code.trim()) { setError("Code is required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        await onSubmit({
          name: form.name,
          description: form.description || undefined,
          color: form.color,
          icon: form.icon,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        } as UpdateComplianceCategoryInput);
      } else {
        await onSubmit({
          name: form.name,
          description: form.description || undefined,
          code: form.code.toUpperCase(),
          color: form.color,
          icon: form.icon,
          sortOrder: form.sortOrder,
        } as CreateComplianceCategoryInput);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 50, padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: 16, width: "100%", maxWidth: 480,
          maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            {isEdit ? "Edit Category" : "New Category"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Icon preview + color */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", background: `${form.color}14`, border: `1px solid ${form.color}30`, borderRadius: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${form.color}22`, border: `2px solid ${form.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
              {form.icon}
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: form.color }}>{form.name || "Category Name"}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{form.code || "CODE"}</p>
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <label className="label">Icon</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, icon: ic }))}
                  style={{
                    width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${form.icon === ic ? form.color : "var(--border)"}`,
                    background: form.icon === ic ? `${form.color}18` : "var(--bg-elevated)",
                    cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="label">Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, color: c }))}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", background: c, border: `3px solid ${form.color === c ? "var(--text-primary)" : "transparent"}`,
                    cursor: "pointer", outline: form.color === c ? `2px solid ${c}` : "none", outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="label">Name *</label>
            <input
              className="input" placeholder="e.g. Tax Compliance"
              value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required
            />
          </div>

          {/* Code (create only) */}
          {!isEdit && (
            <div>
              <label className="label">Code *</label>
              <input
                className="input" placeholder="e.g. TAX (uppercase)"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") }))}
                required
              />
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Unique identifier, uppercase letters only</p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea
              className="input" rows={2} placeholder="What compliance items belong here?"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              style={{ resize: "vertical" }}
            />
          </div>

          {/* Sort order */}
          <div>
            <label className="label">Sort Order</label>
            <input
              className="input" type="number" min={0} max={999}
              value={form.sortOrder}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
            />
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <div
                onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
                style={{
                  width: 40, height: 22, borderRadius: 99, background: form.isActive ? "#10b981" : "var(--border)",
                  position: "relative", transition: "background 0.2s", cursor: "pointer", flexShrink: 0,
                }}
              >
                <div style={{
                  position: "absolute", top: 3, left: form.isActive ? 21 : 3,
                  width: 16, height: 16, borderRadius: "50%", background: "#fff",
                  transition: "left 0.2s",
                }} />
              </div>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {form.isActive ? "Active" : "Inactive"}
              </span>
            </label>
          )}

          {error && (
            <p style={{ fontSize: 13, color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "8px 12px", borderRadius: 8 }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-brand" style={{ flex: 2 }} disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Category"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Type Form Modal ────────────────────────────────────────────
function TypeFormModal({
  categories,
  initial,
  defaultCategoryId,
  onClose,
  onSubmit,
}: {
  categories: ComplianceCategoryRecord[];
  initial?: ComplianceTypeRecord;
  defaultCategoryId?: string;
  onClose: () => void;
  onSubmit: (data: CreateComplianceTypeInput) => Promise<void>;
}) {
  const [form, setForm] = useState({
    categoryId: initial?.categoryId ?? defaultCategoryId ?? "",
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    code: initial?.code ?? "",
    validityDays: initial?.validityDays?.toString() ?? "",
    defaultPenalty: initial?.defaultPenalty ?? "",
    requiredDocuments: initial?.requiredDocuments ?? [] as string[],
    sortOrder: initial?.sortOrder ?? 0,
  });
  const [docInput, setDocInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addDoc = () => {
    const d = docInput.trim();
    if (!d || form.requiredDocuments.includes(d)) return;
    setForm((p) => ({ ...p, requiredDocuments: [...p.requiredDocuments, d] }));
    setDocInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId) { setError("Select a category"); return; }
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.code.trim()) { setError("Code is required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        categoryId: form.categoryId,
        name: form.name,
        description: form.description || undefined,
        code: form.code.toUpperCase(),
        requiredDocuments: form.requiredDocuments,
        validityDays: form.validityDays ? parseInt(form.validityDays) : undefined,
        defaultPenalty: form.defaultPenalty ? parseFloat(form.defaultPenalty) : undefined,
        sortOrder: form.sortOrder,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: 16, width: "100%", maxWidth: 500,
          maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            {initial ? "Edit Type" : "New Compliance Type"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, fontSize: 18 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Category */}
          <div>
            <label className="label">Category *</label>
            <select
              className="input" value={form.categoryId}
              onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))} required
            >
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">Name *</label>
              <input className="input" placeholder="e.g. GST Return" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Code *</label>
              <input
                className="input" placeholder="e.g. GST_RETURN"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input" rows={2} placeholder="What this type covers…"
              value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              style={{ resize: "vertical" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">Validity (days)</label>
              <input
                className="input" type="number" min={0} placeholder="e.g. 365"
                value={form.validityDays} onChange={(e) => setForm((p) => ({ ...p, validityDays: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Default Penalty (₹)</label>
              <input
                className="input" type="number" min={0} step="0.01" placeholder="e.g. 5000"
                value={form.defaultPenalty} onChange={(e) => setForm((p) => ({ ...p, defaultPenalty: e.target.value }))}
              />
            </div>
          </div>

          {/* Required documents */}
          <div>
            <label className="label">Required Documents</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {form.requiredDocuments.map((doc) => (
                <span
                  key={doc}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
                    background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)",
                    borderRadius: 99, fontSize: 11, color: "#6366f1", fontWeight: 600,
                  }}
                >
                  {doc}
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, requiredDocuments: p.requiredDocuments.filter((d) => d !== doc) }))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1", padding: 0, fontSize: 12 }}
                  >×</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input" placeholder="Add required document" value={docInput}
                onChange={(e) => setDocInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDoc(); } }}
                style={{ flex: 1 }}
              />
              <button type="button" onClick={addDoc} className="btn-ghost"><Plus size={14} /></button>
            </div>
          </div>

          {error && (
            <p style={{ fontSize: 13, color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "8px 12px", borderRadius: 8 }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-brand" style={{ flex: 2 }} disabled={submitting}>
              {submitting ? "Saving…" : initial ? "Save Changes" : "Create Type"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Category Row ───────────────────────────────────────────────
function CategoryRow({
  category,
  allTypes,
  onEdit,
  onDelete,
  onToggle,
  onAddType,
  onEditType,
  onDeleteType,
}: {
  category: ComplianceCategoryRecord;
  allTypes: ComplianceTypeRecord[];
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onAddType: () => void;
  onEditType: (t: ComplianceTypeRecord) => void;
  onDeleteType: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const types = allTypes.filter((t) => t.categoryId === category.id);

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: 12, overflow: "hidden",
        opacity: category.isActive ? 1 : 0.65,
      }}
    >
      {/* Category header row */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
          cursor: "pointer",
        }}
        onClick={() => setExpanded((x) => !x)}
      >
        <GripVertical size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />

        {/* Icon */}
        <div
          style={{
            width: 36, height: 36, borderRadius: 10, background: `${category.color}18`,
            border: `1.5px solid ${category.color}30`, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 16, flexShrink: 0,
          }}
        >
          {category.icon}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{category.name}</p>
            <span style={{ fontSize: 10, fontFamily: "monospace", color: category.color, background: `${category.color}14`, padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
              {category.code}
            </span>
            {category.isSystem && (
              <span style={{ fontSize: 10, color: "#6366f1", background: "rgba(99,102,241,0.1)", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                System
              </span>
            )}
            {!category.isActive && (
              <span style={{ fontSize: 10, color: "#6b7280", background: "rgba(107,114,128,0.1)", padding: "1px 6px", borderRadius: 4 }}>
                Inactive
              </span>
            )}
          </div>
          {category.description && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {category.description}
            </p>
          )}
        </div>

        {/* Type count */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>{types.length}</span> type{types.length !== 1 ? "s" : ""}
          </span>
          {(category._count?.submissions ?? 0) > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", padding: "1px 6px", borderRadius: 99 }}>
              {category._count!.submissions} submission{category._count!.submissions !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          title={category.isActive ? "Deactivate" : "Activate"}
          style={{ background: "none", border: "none", cursor: "pointer", color: category.isActive ? "#10b981" : "var(--text-muted)", padding: 4 }}
        >
          {category.isActive ? <CheckCircle size={16} /> : <XCircle size={16} />}
        </button>

        {/* Menu */}
        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((x) => !x); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
          >
            <MoreVertical size={16} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                style={{
                  position: "absolute", right: 0, top: 28, zIndex: 20,
                  background: "var(--bg-surface)", border: "1px solid var(--border)",
                  borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                  minWidth: 160, overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => { setMenuOpen(false); onAddType(); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", textAlign: "left" }}
                >
                  <Plus size={13} /> Add Type
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onEdit(); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", textAlign: "left" }}
                >
                  <Edit2 size={13} /> Edit Category
                </button>
                {!category.isSystem && (
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#ef4444", textAlign: "left" }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {expanded ? <ChevronUp size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      </div>

      {/* Types panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            style={{ overflow: "hidden", borderTop: "1px solid var(--border)" }}
          >
            <div style={{ padding: "12px 16px 12px 64px" }}>
              {types.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>
                  No types defined.{" "}
                  <button
                    onClick={onAddType}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1", fontWeight: 600, fontSize: 12, padding: 0 }}
                  >
                    Add one →
                  </button>
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {types.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                        background: "var(--bg-elevated)", borderRadius: 8,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <Tag size={12} style={{ color: category.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</span>
                          <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)" }}>{t.code}</span>
                          {!t.isActive && <span style={{ fontSize: 10, color: "#6b7280" }}>Inactive</span>}
                        </div>
                        {t.description && (
                          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{t.description}</p>
                        )}
                        {t.requiredDocuments.length > 0 && (
                          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                            {t.requiredDocuments.map((d) => (
                              <span key={d} style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px" }}>
                                {d}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {t.validityDays && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{t.validityDays}d</span>
                      )}
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button onClick={() => onEditType(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
                          <Edit2 size={13} />
                        </button>
                        {!t.isSystem && (
                          <button onClick={() => onDeleteType(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={onAddType}
                style={{
                  display: "flex", alignItems: "center", gap: 6, marginTop: 8,
                  background: "none", border: "1px dashed var(--border)", borderRadius: 8,
                  padding: "7px 14px", cursor: "pointer", color: "var(--text-muted)",
                  fontSize: 12, width: "100%", justifyContent: "center", transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = category.color; e.currentTarget.style.color = category.color; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                <Plus size={12} /> Add Type
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function CategoriesPage() {
  const {
    categories, loading: catLoading, error: catError,
    refetch, createCategory, updateCategory, deleteCategory, seedDefaults,
  } = useComplianceCategories();

  const { types, loading: typesLoading, createType, deleteType } = useComplianceTypes();

  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<ComplianceCategoryRecord | null>(null);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingType, setEditingType] = useState<ComplianceTypeRecord | null>(null);
  const [defaultTypeCategoryId, setDefaultTypeCategoryId] = useState<string | undefined>();
  const [seeding, setSeeding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category? This cannot be undone.")) return;
    setDeletingId(id);
    try { await deleteCategory(id); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed to delete"); }
    finally { setDeletingId(null); }
  };

  const handleToggleActive = async (cat: ComplianceCategoryRecord) => {
    try { await updateCategory(cat.id, { isActive: !cat.isActive }); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed to update"); }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm("Delete this compliance type?")) return;
    try { await deleteType(id); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed to delete"); }
  };

  const handleSeed = async () => {
    if (!confirm("Seed default compliance categories? Existing ones won't be overwritten.")) return;
    setSeeding(true);
    try { await seedDefaults(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed to seed"); }
    finally { setSeeding(false); }
  };

  const loading = catLoading || typesLoading;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link href="/compliance" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>Compliance</Link>
            <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>Categories</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Compliance Categories</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>
            {categories.length} categor{categories.length !== 1 ? "ies" : "y"} · {types.length} type{types.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={refetch} style={{ padding: "8px 12px" }} title="Refresh">
            <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
          <button
            className="btn-ghost"
            onClick={handleSeed}
            disabled={seeding}
            style={{ padding: "8px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
          >
            <Sparkles size={13} /> {seeding ? "Seeding…" : "Seed Defaults"}
          </button>
          <button className="btn-ghost" onClick={() => { setShowTypeForm(true); setDefaultTypeCategoryId(undefined); }} style={{ padding: "8px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Layers size={13} /> New Type
          </button>
          <button className="btn-brand" onClick={() => setShowCatForm(true)}>
            <Plus size={14} /> New Category
          </button>
        </div>
      </div>

      {catError && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
          {catError}
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Categories", value: categories.length, color: "#6366f1" },
          { label: "Active", value: categories.filter((c) => c.isActive).length, color: "#10b981" },
          { label: "Inactive", value: categories.filter((c) => !c.isActive).length, color: "#6b7280" },
          { label: "Total Types", value: types.length, color: "#3b82f6" },
          { label: "System", value: categories.filter((c) => c.isSystem).length, color: "#f59e0b" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "12px 16px",
            }}
          >
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              {stat.label}
            </p>
            <p style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Category list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 68, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No categories yet</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
            Start by seeding defaults or create your own category
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn-ghost" onClick={handleSeed} disabled={seeding} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={14} /> Seed Defaults
            </button>
            <button className="btn-brand" onClick={() => setShowCatForm(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> New Category
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              allTypes={types}
              onEdit={() => setEditingCat(cat)}
              onDelete={() => handleDeleteCategory(cat.id)}
              onToggle={() => handleToggleActive(cat)}
              onAddType={() => { setDefaultTypeCategoryId(cat.id); setEditingType(null); setShowTypeForm(true); }}
              onEditType={(t) => { setEditingType(t); setShowTypeForm(true); }}
              onDeleteType={handleDeleteType}
            />
          ))}
        </div>
      )}

      {/* Category form modal */}
      {(showCatForm || editingCat) && (
        <CategoryFormModal
          initial={editingCat ?? undefined}
          onClose={() => { setShowCatForm(false); setEditingCat(null); }}
          onSubmit={async (data) => {
            if (editingCat) {
              await updateCategory(editingCat.id, data as UpdateComplianceCategoryInput);
            } else {
              await createCategory(data as CreateComplianceCategoryInput);
            }
            setShowCatForm(false);
            setEditingCat(null);
          }}
        />
      )}

      {/* Type form modal */}
      {showTypeForm && (
        <TypeFormModal
          categories={categories}
          initial={editingType ?? undefined}
          defaultCategoryId={defaultTypeCategoryId}
          onClose={() => { setShowTypeForm(false); setEditingType(null); }}
          onSubmit={async (data) => {
            await createType(data);
            setShowTypeForm(false);
            setEditingType(null);
          }}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
