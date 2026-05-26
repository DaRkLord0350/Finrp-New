"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Plus, Trash2, ArrowLeft, Send, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/formatters/currency";

interface LineItem {
  id: string;
  itemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface CustomerOption {
  id: string;
  name: string;
  company?: string | null;
}

interface InventoryItem {
  id: string;
  name: string;
  price: number;
  description?: string | null;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState(18);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { id: "1", description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    Promise.all([fetch("/api/customers"), fetch("/api/items")]).then(
      async ([customersRes, itemsRes]) => {
        if (customersRes.ok) {
          const data = await customersRes.json();
          setCustomers(Array.isArray(data) ? data : []);
        }
        if (itemsRes.ok) {
          const data = await itemsRes.json();
          setInventoryItems(data.items ?? []);
        }
      }
    );
  }, []);

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter((i) => i.id !== id));
  };

  const updateItem = (
    id: string,
    field: keyof LineItem,
    value: string | number
  ) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const selectInventoryItem = (lineId: string, inventoryItemId: string) => {
    if (!inventoryItemId) return;
    const found = inventoryItems.find((i) => i.id === inventoryItemId);
    if (!found) return;
    setItems(
      items.map((item) =>
        item.id === lineId
          ? {
              ...item,
              itemId: found.id,
              description: found.name,
              unitPrice: found.price,
            }
          : item
      )
    );
  };

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handleSubmit = async (status: "DRAFT" | "SENT") => {
    setError("");
    if (!customerId) {
      setError("Please select a customer.");
      return;
    }
    if (!dueDate) {
      setError("Please set a due date.");
      return;
    }
    const lineItems = items.filter(
      (i) => i.description.trim() && i.unitPrice > 0
    );
    if (!lineItems.length) {
      setError("Add at least one line item with a description and price.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          dueDate,
          taxRate,
          notes,
          status,
          items: lineItems.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create invoice");
      }
      router.push("/billing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <Link
          href="/billing"
          className="btn-ghost"
          style={{ padding: "8px 12px", gap: 6 }}
        >
          <ArrowLeft size={15} /> Back
        </Link>
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            New Invoice
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 13,
              marginTop: 2,
            }}
          >
            Create a new invoice for a customer
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            color: "#ef4444",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Left — Invoice Form */}
        <motion.div
          className="surface"
          style={{ padding: 28 }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Customer & Date */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div>
              <label className="label">Customer *</label>
              <select
                className="input"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.company ? ` — ${c.company}` : ""}
                  </option>
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: inventoryItems.length
                  ? "160px 1fr 80px 120px 40px"
                  : "1fr 80px 120px 40px",
                gap: 8,
                marginBottom: 8,
              }}
            >
              {inventoryItems.length > 0 && (
                <span className="label" style={{ marginBottom: 0 }}>
                  Item
                </span>
              )}
              <span className="label" style={{ marginBottom: 0 }}>
                Description
              </span>
              <span className="label" style={{ marginBottom: 0 }}>
                Qty
              </span>
              <span className="label" style={{ marginBottom: 0 }}>
                Unit Price
              </span>
              <span />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: inventoryItems.length
                      ? "160px 1fr 80px 120px 40px"
                      : "1fr 80px 120px 40px",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  {inventoryItems.length > 0 && (
                    <select
                      className="input"
                      style={{ fontSize: 12 }}
                      value={item.itemId ?? ""}
                      onChange={(e) =>
                        selectInventoryItem(item.id, e.target.value)
                      }
                    >
                      <option value="">Pick item...</option>
                      {inventoryItems.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    className="input"
                    placeholder="Description..."
                    value={item.description}
                    onChange={(e) =>
                      updateItem(item.id, "description", e.target.value)
                    }
                  />
                  <input
                    type="number"
                    className="input"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(
                        item.id,
                        "quantity",
                        parseFloat(e.target.value) || 0
                      )
                    }
                  />
                  <input
                    type="number"
                    className="input"
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                    value={item.unitPrice || ""}
                    onChange={(e) =>
                      updateItem(
                        item.id,
                        "unitPrice",
                        parseFloat(e.target.value) || 0
                      )
                    }
                  />
                  <button
                    onClick={() => removeItem(item.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color:
                        items.length === 1 ? "var(--text-muted)" : "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 36,
                      height: 36,
                      borderRadius: 8,
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
            <h3
              style={{
                fontSize: 15,
                fontWeight: 600,
                marginBottom: 16,
                color: "var(--text-primary)",
              }}
            >
              Invoice Summary
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Subtotal", value: formatCurrency(subtotal) },
                {
                  label: `Tax (${taxRate}%)`,
                  value: formatCurrency(taxAmount),
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span
                    style={{ fontSize: 13, color: "var(--text-secondary)" }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--text-primary)",
                      fontWeight: 500,
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}

              <div
                style={{
                  height: 1,
                  background: "var(--border)",
                  margin: "4px 0",
                }}
              />

              <div
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  Total
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#818cf8",
                  }}
                >
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div
            className="surface"
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <button
              className="btn-brand"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "11px",
              }}
              onClick={() => handleSubmit("SENT")}
              disabled={saving}
            >
              <Send size={15} />
              {saving ? "Saving..." : "Send Invoice"}
            </button>
            <button
              className="btn-ghost"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "11px",
              }}
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
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 10,
                }}
              >
                Line Items
              </p>
              {items
                .filter((i) => i.description)
                .map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        flex: 1,
                        paddingRight: 8,
                      }}
                    >
                      {item.description}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        flexShrink: 0,
                      }}
                    >
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
