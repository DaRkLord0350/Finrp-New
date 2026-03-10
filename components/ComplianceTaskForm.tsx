"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, Calendar, Tag, FileText } from "lucide-react";
import type { ComplianceCategory, CreateComplianceTaskInput } from "@/types";

interface ComplianceTaskFormProps {
  onClose: () => void;
  onSubmit: (data: CreateComplianceTaskInput) => Promise<void>;
}

const CATEGORIES: { value: ComplianceCategory; label: string; color: string }[] = [
  { value: "TAX", label: "Tax", color: "#6366f1" },
  { value: "REGULATORY", label: "Regulatory", color: "#3b82f6" },
  { value: "LICENSE", label: "License", color: "#f59e0b" },
  { value: "AUDIT", label: "Audit", color: "#8b5cf6" },
  { value: "REPORTING", label: "Reporting", color: "#10b981" },
  { value: "OTHER", label: "Other", color: "#52525b" },
];

export default function ComplianceTaskForm({ onClose, onSubmit }: ComplianceTaskFormProps) {
  const [form, setForm] = useState<CreateComplianceTaskInput>({
    title: "",
    description: "",
    category: "TAX",
    dueDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.dueDate) { setError("Due date is required."); return; }
    try {
      setSaving(true);
      await onSubmit(form);
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const selectedCat = CATEGORIES.find((c) => c.value === form.category);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
            borderRadius: 16, padding: 28, width: "100%", maxWidth: 480,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <ShieldCheck size={16} color="#f59e0b" />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                Add Compliance Task
              </h2>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
              <X size={18} />
            </button>
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8,
              color: "#ef4444", fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              {/* Title */}
              <div>
                <label className="label">Task Title *</label>
                <input
                  className="input"
                  placeholder="e.g. Q2 GST Filing"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              {/* Category */}
              <div>
                <label className="label">Category</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setForm({ ...form, category: cat.value })}
                      style={{
                        padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                        border: "1px solid",
                        background: form.category === cat.value ? `${cat.color}20` : "transparent",
                        borderColor: form.category === cat.value ? `${cat.color}60` : "var(--border)",
                        color: form.category === cat.value ? cat.color : "var(--text-secondary)",
                        cursor: "pointer", transition: "all 0.15s ease",
                        display: "flex", alignItems: "center", gap: 5,
                      }}
                    >
                      <Tag size={11} />
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="label">Due Date *</label>
                <div style={{ position: "relative" }}>
                  <Calendar size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input
                    type="date"
                    className="input"
                    style={{ paddingLeft: 36 }}
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="label">Description</label>
                <div style={{ position: "relative" }}>
                  <FileText size={14} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }} />
                  <textarea
                    className="input"
                    style={{ paddingLeft: 36, minHeight: 80, resize: "vertical" }}
                    placeholder="Additional details about this compliance task..."
                    value={form.description ?? ""}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Preview badge */}
            {form.title && (
              <div style={{
                padding: "10px 14px", background: "var(--bg-elevated)",
                border: "1px solid var(--border)", borderRadius: 10, marginBottom: 16,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: `${selectedCat?.color ?? "#52525b"}18`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ShieldCheck size={13} color={selectedCat?.color ?? "#52525b"} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{form.title}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {selectedCat?.label} {form.dueDate ? `· Due ${form.dueDate}` : ""}
                  </p>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={onClose} className="btn-ghost" style={{ flex: 1, justifyContent: "center" }}>
                Cancel
              </button>
              <button type="submit" className="btn-brand" style={{ flex: 2, justifyContent: "center" }} disabled={saving}>
                {saving ? "Creating..." : "Add Task"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
