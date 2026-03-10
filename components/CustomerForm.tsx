"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Mail, Phone, Building, MapPin, FileText } from "lucide-react";
import type { CreateCustomerInput } from "@/types";

interface CustomerFormProps {
  onClose: () => void;
  onSubmit: (data: CreateCustomerInput) => Promise<void>;
  initialData?: Partial<CreateCustomerInput>;
  mode?: "create" | "edit";
}

export default function CustomerForm({
  onClose,
  onSubmit,
  initialData,
  mode = "create",
}: CustomerFormProps) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const fields = [
    { key: "name", label: "Full Name *", icon: User, placeholder: "John Smith", type: "text" },
    { key: "email", label: "Email Address", icon: Mail, placeholder: "john@company.com", type: "email" },
    { key: "phone", label: "Phone Number", icon: Phone, placeholder: "+1 415 555 0101", type: "tel" },
    { key: "company", label: "Company", icon: Building, placeholder: "Acme Corp", type: "text" },
    { key: "address", label: "Address", icon: MapPin, placeholder: "123 Business Ave, NY", type: "text" },
  ];

  return (
    <AnimatePresence>
      {/* Backdrop */}
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
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
            borderRadius: 16, padding: 28, width: "100%", maxWidth: 500,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <User size={16} color="#818cf8" />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                {mode === "create" ? "Add Customer" : "Edit Customer"}
              </h2>
            </div>
            <button onClick={onClose} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", padding: 4, borderRadius: 6,
            }}>
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
              {fields.map(({ key, label, icon: Icon, placeholder, type }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <div style={{ position: "relative" }}>
                    <Icon size={14} style={{
                      position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }} />
                    <input
                      type={type}
                      className="input"
                      style={{ paddingLeft: 36 }}
                      placeholder={placeholder}
                      value={form[key as keyof CreateCustomerInput] ?? ""}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </div>
                </div>
              ))}

              <div>
                <label className="label">Notes</label>
                <div style={{ position: "relative" }}>
                  <FileText size={14} style={{
                    position: "absolute", left: 12, top: 12,
                    color: "var(--text-muted)",
                  }} />
                  <textarea
                    className="input"
                    style={{ paddingLeft: 36, minHeight: 80, resize: "vertical" }}
                    placeholder="Any additional notes about this customer..."
                    value={form.notes ?? ""}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={onClose} className="btn-ghost" style={{ flex: 1, justifyContent: "center" }}>
                Cancel
              </button>
              <button type="submit" className="btn-brand" style={{ flex: 2, justifyContent: "center" }} disabled={saving}>
                {saving ? "Saving..." : mode === "create" ? "Add Customer" : "Save Changes"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
