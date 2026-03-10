"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Plus, Trash2, ArrowLeft, Send, Save } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const mockCustomers = [
  { id: "1", name: "Acme Corporation" },
  { id: "2", name: "TechFlow Solutions" },
  { id: "3", name: "BrightStar Media" },
  { id: "4", name: "Quantum Ventures" },
  { id: "5", name: "NovaBuild Partners" },
];

export default function NewInvoicePage() {
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState(10);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { id: "1", description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handleSubmit = async (status: "DRAFT" | "SENT") => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    alert(`Invoice saved as ${status}!`);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <Link href="/billing" className="btn-ghost" style={{ padding: "8px 12px", gap: 6 }}>
          <ArrowLeft size={15} /> Back
        </Link>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>New Invoice</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>Create a new invoice for a customer</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        {/* Left — Invoice Form */}
        <motion.div
          className="surface"
          style={{ padding: 28 }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Customer & Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div>
              <label className="label">Customer *</label>
              <select
                className="input"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Select customer...</option>
                {mockCustomers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Due Date *</label>
              <input
                type="date"
                className="input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Line Items */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px 40px", gap: 8, marginBottom: 8 }}>
              <span className="label" style={{ marginBottom: 0 }}>Description</span>
              <span className="label" style={{ marginBottom: 0 }}>Qty</span>
              <span className="label" style={{ marginBottom: 0 }}>Unit Price</span>
              <span />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px 40px", gap: 8, alignItems: "center" }}
                >
                  <input
                    className="input"
                    placeholder="Description of service or product..."
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                  />
                  <input
                    type="number"
                    className="input"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                  />
                  <input
                    type="number"
                    className="input"
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                    value={item.unitPrice || ""}
                    onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                  />
                  <button
                    onClick={() => removeItem(item.id)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: items.length === 1 ? "var(--text-muted)" : "#ef4444",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 36, height: 36, borderRadius: 8,
                    }}
                    disabled={items.length === 1}
                  >
                    <Trash2 size={15} />
                  </button>
                </motion.div>
              ))}
            </div>

            <button
              onClick={addItem}
              className="btn-ghost"
              style={{ marginTop: 12, gap: 6, fontSize: 13 }}
            >
              <Plus size={14} /> Add line item
            </button>
          </div>

          {/* Tax Rate & Notes */}
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 16 }}>
            <div>
              <label className="label">Tax Rate (%)</label>
              <input
                type="number"
                className="input"
                min={0}
                max={100}
                step={0.5}
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <input
                className="input"
                placeholder="Payment terms, instructions, or any notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </motion.div>

        {/* Right — Summary */}
        <motion.div
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="surface" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "var(--text-primary)" }}>
              Invoice Summary
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Subtotal", value: formatCurrency(subtotal) },
                { label: `Tax (${taxRate}%)`, value: formatCurrency(taxAmount) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
                </div>
              ))}

              <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#818cf8" }}>
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="surface" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              className="btn-brand"
              style={{ width: "100%", justifyContent: "center", padding: "11px" }}
              onClick={() => handleSubmit("SENT")}
              disabled={saving}
            >
              <Send size={15} />
              {saving ? "Sending..." : "Send Invoice"}
            </button>
            <button
              className="btn-ghost"
              style={{ width: "100%", justifyContent: "center", padding: "11px" }}
              onClick={() => handleSubmit("DRAFT")}
              disabled={saving}
            >
              <Save size={15} />
              Save as Draft
            </button>
          </div>

          {/* Items breakdown */}
          {items.some((i) => i.description && i.unitPrice > 0) && (
            <div className="surface" style={{ padding: 16 }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Line Items
              </p>
              {items.filter((i) => i.description).map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1, paddingRight: 8 }}>{item.description}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", flexShrink: 0 }}>
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
