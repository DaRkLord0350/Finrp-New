"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { CreateCustomerInput } from "@/types";

interface CustomerFormProps {
  onClose: () => void;
  onSubmit: (data: CreateCustomerInput) => Promise<void>;
  initialData?: Partial<CreateCustomerInput>;
  mode?: "create" | "edit";
}

// ────────────────────────────────────────────────────────────
// NOTE: This modal intentionally mirrors ItemForm ("Add Item")
// one-to-one — backdrop, container, header, inputs, and footer
// buttons share the exact same styling so the two dialogs read
// as a single design language. Keep them in sync if either moves.
// ────────────────────────────────────────────────────────────

const inputStyle = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  padding: "9px 12px",
  fontSize: 14,
  width: "100%",
  outline: "none",
} as const;

const labelStyle = {
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 500 as const,
  marginBottom: 6,
  display: "block" as const,
};

const errorStyle = {
  color: "#ef4444",
  fontSize: 11,
  marginTop: 4,
  display: "block" as const,
};

export default function CustomerForm({
  onClose,
  onSubmit,
  initialData,
  mode = "create",
}: CustomerFormProps) {
  const isEdit = mode === "edit";

  const [form, setForm] = useState<CreateCustomerInput>({
    name: initialData?.name ?? "",
    email: initialData?.email ?? "",
    phone: initialData?.phone ?? "",
    company: initialData?.company ?? "",
    address: initialData?.address ?? "",
    notes: initialData?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (key: keyof CreateCustomerInput, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Customer name is required.");
      return;
    }
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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 480,
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
              {isEdit ? "Edit Customer" : "Add Customer"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              {isEdit ? "Update customer details" : "Add a new customer to your CRM"}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "6px 8px",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Full Name */}
          <div>
            <label style={labelStyle}>Full Name *</label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="John Smith"
              style={inputStyle}
            />
            {error && !form.name.trim() && <span style={errorStyle}>{error}</span>}
          </div>

          {/* Email */}
          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="john@company.com"
              style={inputStyle}
            />
          </div>

          {/* Phone + Company */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="+1 415 555 0101"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Company</label>
              <input
                value={form.company ?? ""}
                onChange={(e) => setField("company", e.target.value)}
                placeholder="Acme Corp"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label style={labelStyle}>Address</label>
            <input
              value={form.address ?? ""}
              onChange={(e) => setField("address", e.target.value)}
              placeholder="123 Business Ave, NY"
              style={inputStyle}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Any additional notes about this customer..."
              rows={2}
              style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }}
            />
          </div>

          {/* General error (submit failures) */}
          {error && form.name.trim() && (
            <span style={{ ...errorStyle, marginTop: 0 }}>{error}</span>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} className="btn-ghost" style={{ flex: 1 }}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-brand"
              disabled={saving}
              style={{ flex: 1, justifyContent: "center" }}
            >
              {saving
                ? isEdit
                  ? "Saving..."
                  : "Adding..."
                : isEdit
                ? "Save Changes"
                : "Add Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
