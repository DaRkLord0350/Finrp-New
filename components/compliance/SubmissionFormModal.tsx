"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, Tag } from "lucide-react";
import type { CreateComplianceSubmissionInput, ComplianceCategoryRecord, ComplianceTypeRecord } from "@/types/compliance";

interface Props {
  categories: ComplianceCategoryRecord[];
  types: ComplianceTypeRecord[];
  onClose: () => void;
  onSubmit: (data: CreateComplianceSubmissionInput) => Promise<void>;
}

export default function SubmissionFormModal({ categories, types, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<CreateComplianceSubmissionInput>({
    categoryId: "",
    typeId: "",
    title: "",
    description: "",
    referenceNumber: "",
    dueDate: "",
    expiryDate: "",
    status: "DRAFT",
    tags: [],
    notes: "",
  });
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTypes = types.filter(
    (t) => !form.categoryId || t.categoryId === form.categoryId
  );

  const set = (field: keyof CreateComplianceSubmissionInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value || null }));

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || (form.tags ?? []).includes(tag)) return;
    setForm((p) => ({ ...p, tags: [...(p.tags ?? []), tag] }));
    setTagInput("");
  };

  const removeTag = (tag: string) =>
    setForm((p) => ({ ...p, tags: (p.tags ?? []).filter((t) => t !== tag) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId) { setError("Please select a category"); return; }
    if (!form.title?.trim()) { setError("Title is required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : null,
        typeId: form.typeId || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create submission");
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            New Compliance Submission
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6 }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Category + Type */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="label">Category *</label>
                <select
                  className="input"
                  value={form.categoryId}
                  onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value, typeId: "" }))}
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={form.typeId ?? ""}
                  onChange={set("typeId")}
                  disabled={!form.categoryId || availableTypes.length === 0}
                >
                  <option value="">Select type (optional)</option>
                  {availableTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="label">Title *</label>
              <input
                className="input"
                placeholder="e.g. GST Return Q1 FY26"
                value={form.title}
                onChange={set("title")}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Brief description of this compliance item"
                value={form.description ?? ""}
                onChange={set("description")}
                style={{ resize: "vertical" }}
              />
            </div>

            {/* Reference + Status */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="label">Reference No.</label>
                <input
                  className="input"
                  placeholder="Govt / internal reference"
                  value={form.referenceNumber ?? ""}
                  onChange={set("referenceNumber")}
                />
              </div>
              <div>
                <label className="label">Initial Status</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      status: e.target.value as CreateComplianceSubmissionInput["status"],
                    }))
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                </select>
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="label">Due Date</label>
                <input
                  className="input"
                  type="date"
                  value={form.dueDate ?? ""}
                  onChange={set("dueDate")}
                />
              </div>
              <div>
                <label className="label">Expiry Date</label>
                <input
                  className="input"
                  type="date"
                  value={form.expiryDate ?? ""}
                  onChange={set("expiryDate")}
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="label">Tags</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                {(form.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      background: "rgba(99,102,241,0.1)",
                      border: "1px solid rgba(99,102,241,0.3)",
                      borderRadius: 99,
                      fontSize: 11,
                      color: "#6366f1",
                      fontWeight: 600,
                    }}
                  >
                    <Tag size={9} />
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1", padding: 0, fontSize: 12 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  placeholder="Add tag and press Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={addTag} className="btn-ghost">
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="label">Notes</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Internal notes"
                value={form.notes ?? ""}
                onChange={set("notes")}
                style={{ resize: "vertical" }}
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "8px 12px", borderRadius: 8 }}>
                {error}
              </p>
            )}
          </div>

          <div style={{ padding: "0 24px 20px", display: "flex", gap: 10 }}>
            <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-brand" style={{ flex: 2 }} disabled={submitting}>
              {submitting ? "Creating…" : "Create Submission"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
