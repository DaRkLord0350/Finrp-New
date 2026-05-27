"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Send,
  Save,
  Search,
  Package,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  ChevronDown,
  Download,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/formatters/currency";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Customer {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
}

interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  sellingPrice: string;
  taxRate: string;
  stock: number;
  isActive: boolean;
}

interface LineItem {
  id: string;
  itemId?: string;
  sku?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
}

// ---------------------------------------------------------------------------
// CustomerCombobox
// ---------------------------------------------------------------------------
function CustomerCombobox({
  customers,
  value,
  onChange,
  loading,
}: {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = customers.find((c) => c.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = customers.filter((c) => {
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company?.toLowerCase() ?? "").includes(q) ||
      (c.email?.toLowerCase() ?? "").includes(q)
    );
  });

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          textAlign: "left",
          cursor: "pointer",
          width: "100%",
        }}
        disabled={loading}
      >
        {loading ? (
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Loading customers…
          </span>
        ) : selected ? (
          <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
            {selected.name}
            {selected.company ? ` · ${selected.company}` : ""}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Select customer…
          </span>
        )}
        <ChevronDown
          size={14}
          style={{ color: "var(--text-muted)", flexShrink: 0, marginLeft: 8 }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: 10,
              boxShadow: "var(--shadow-lg)",
              zIndex: 200,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "8px 10px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Search size={13} style={{ color: "var(--text-muted)" }} />
              <input
                autoFocus
                placeholder="Search customers…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  background: "none",
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  width: "100%",
                }}
              />
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: "12px 14px",
                    fontSize: 13,
                    color: "var(--text-muted)",
                    textAlign: "center",
                  }}
                >
                  No customers found
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onChange(c.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "9px 14px",
                      background:
                        c.id === value ? "rgba(99,102,241,0.08)" : "none",
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "rgba(99,102,241,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        c.id === value ? "rgba(99,102,241,0.08)" : "none";
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                      }}
                    >
                      {c.name}
                    </div>
                    {(c.company || c.email) && (
                      <div
                        style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}
                      >
                        {[c.company, c.email].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
            <div
              style={{
                padding: "8px 14px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <Link
                href="/crm"
                style={{
                  fontSize: 12,
                  color: "#818cf8",
                  textDecoration: "none",
                }}
              >
                + Manage customers →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ItemPicker — per-line-item catalog selector
// ---------------------------------------------------------------------------
function ItemPicker({
  items,
  selectedId,
  onSelect,
}: {
  items: InventoryItem[];
  selectedId?: string;
  onSelect: (item: InventoryItem | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.id === selectedId);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = items.filter((i) => {
    const q = query.toLowerCase();
    return (
      i.name.toLowerCase().includes(q) ||
      (i.sku?.toLowerCase() ?? "").includes(q)
    );
  });

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "6px 8px",
          background: selected
            ? "rgba(99,102,241,0.1)"
            : "var(--bg-elevated)",
          border: "1px solid",
          borderColor: selected ? "rgba(99,102,241,0.3)" : "var(--border)",
          borderRadius: 7,
          cursor: "pointer",
          fontSize: 11,
          color: selected ? "#818cf8" : "var(--text-muted)",
          whiteSpace: "nowrap",
          maxWidth: 160,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <Package size={12} />
        <span
          style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}
        >
          {selected ? selected.name : "From catalog"}
        </span>
        {selected ? (
          <X
            size={10}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
            }}
          />
        ) : (
          <ChevronDown size={10} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              width: 260,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: 10,
              boxShadow: "var(--shadow-lg)",
              zIndex: 200,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "7px 10px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Search size={12} style={{ color: "var(--text-muted)" }} />
              <input
                autoFocus
                placeholder="Search items…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  background: "none",
                  border: "none",
                  outline: "none",
                  fontSize: 12,
                  color: "var(--text-primary)",
                  width: "100%",
                }}
              />
            </div>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: "10px 12px",
                    fontSize: 12,
                    color: "var(--text-muted)",
                    textAlign: "center",
                  }}
                >
                  No items found
                </div>
              ) : (
                filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item);
                      setOpen(false);
                      setQuery("");
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      background:
                        item.id === selectedId
                          ? "rgba(99,102,241,0.08)"
                          : "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "rgba(99,102,241,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        item.id === selectedId
                          ? "rgba(99,102,241,0.08)"
                          : "none";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--text-primary)",
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{ fontSize: 11, color: "#818cf8", fontWeight: 600 }}
                      >
                        {formatCurrency(Number(item.sellingPrice))}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 2,
                        fontSize: 10,
                        color: "var(--text-muted)",
                      }}
                    >
                      {item.sku && <span>SKU: {item.sku}</span>}
                      <span
                        style={{
                          color: item.stock > 0 ? "#16a34a" : "#ef4444",
                        }}
                      >
                        Stock: {item.stock}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function NewInvoicePage() {
  const router = useRouter();

  // Data state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  // Form state
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState(18);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", description: "", quantity: 1, unitPrice: 0, taxPercent: 0 },
  ]);

  // Submit state
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState<{
    invoiceId: string;
    invoiceNumber: string;
    pdfUrl?: string;
  } | null>(null);

  // Load customers and items on mount
  useEffect(() => {
    async function loadData() {
      setDataLoading(true);
      setDataError("");
      try {
        const [custRes, itemsRes] = await Promise.all([
          fetch("/api/customers"),
          fetch("/api/items"),
        ]);

        if (!custRes.ok) throw new Error("Failed to load customers");
        if (!itemsRes.ok) throw new Error("Failed to load inventory items");

        const custData = await custRes.json();
        const itemsData = await itemsRes.json();

        setCustomers(
          Array.isArray(custData) ? custData : custData.customers ?? []
        );
        setInventoryItems(
          Array.isArray(itemsData) ? itemsData : itemsData.items ?? []
        );
      } catch (err) {
        setDataError(
          err instanceof Error ? err.message : "Failed to load data"
        );
      } finally {
        setDataLoading(false);
      }
    }
    loadData();
  }, []);

  // ── Line item helpers ──
  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        description: "",
        quantity: 1,
        unitPrice: 0,
        taxPercent: taxRate,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateLineItem = useCallback(
    (id: string, updates: Partial<LineItem>) => {
      setLineItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    },
    []
  );

  const handleItemSelect = useCallback(
    (lineId: string, inv: InventoryItem | null) => {
      if (!inv) {
        updateLineItem(lineId, {
          itemId: undefined,
          sku: undefined,
        });
      } else {
        updateLineItem(lineId, {
          itemId: inv.id,
          sku: inv.sku ?? undefined,
          description: inv.name,
          unitPrice: Number(inv.sellingPrice),
          taxPercent: Number(inv.taxRate),
        });
      }
    },
    [updateLineItem]
  );

  // ── Totals ──
  const subtotal = lineItems.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice,
    0
  );
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  // ── Submit ──
  const handleSubmit = async (status: "DRAFT" | "SENT") => {
    setSubmitError("");

    if (!customerId) {
      setSubmitError("Please select a customer.");
      return;
    }
    if (!dueDate) {
      setSubmitError("Please set a due date.");
      return;
    }
    const validItems = lineItems.filter(
      (i) => i.description.trim() && i.unitPrice > 0
    );
    if (validItems.length === 0) {
      setSubmitError(
        "Add at least one line item with a description and price."
      );
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
          notes: notes.trim() || undefined,
          items: validItems.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            sku: i.sku,
            taxPercent: i.taxPercent,
          })),
          status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create invoice");
      }

      const invoice = await res.json();

      // Trigger PDF generation in background
      let pdfUrl: string | undefined;
      try {
        const pdfRes = await fetch(`/api/invoices/${invoice.id}/pdf`, {
          method: "POST",
        });
        if (pdfRes.ok) {
          const pdfData = await pdfRes.json();
          pdfUrl = pdfData.pdfUrl;
        }
      } catch {
        // PDF generation is non-critical; proceed without it
      }

      setSuccess({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        pdfUrl,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // ── Success screen ──
  if (success) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 20,
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(34,197,94,0.12)",
            border: "2px solid rgba(34,197,94,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckCircle2 size={32} color="#22c55e" />
        </motion.div>

        <div style={{ textAlign: "center" }}>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 6,
            }}
          >
            Invoice Created
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            {success.invoiceNumber} has been saved successfully.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {success.pdfUrl && (
            <a
              href={success.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-brand"
              style={{ gap: 7 }}
            >
              <Download size={14} /> Download PDF
            </a>
          )}
          <button
            onClick={() => router.push("/billing")}
            className="btn-ghost"
          >
            View all invoices
          </button>
          <button
            onClick={() => {
              setSuccess(null);
              setCustomerId("");
              setDueDate("");
              setNotes("");
              setLineItems([
                {
                  id: "1",
                  description: "",
                  quantity: 1,
                  unitPrice: 0,
                  taxPercent: 0,
                },
              ]);
            }}
            className="btn-ghost"
          >
            New invoice
          </button>
        </div>
      </div>
    );
  }

  // ── Error loading data ──
  if (dataError) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          padding: 40,
        }}
      >
        <AlertCircle size={40} color="#ef4444" />
        <p style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {dataError}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-ghost"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
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

        {/* Loading indicator */}
        {dataLoading && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            <Loader2 size={14} className="animate-spin" />
            Loading data…
          </div>
        )}
      </div>

      {/* ── Submit error banner ── */}
      {submitError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: "10px 16px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            color: "#ef4444",
            fontSize: 13,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertCircle size={14} />
          {submitError}
        </motion.div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* ─────────────── Left — Invoice Form ─────────────── */}
        <motion.div
          className="surface"
          style={{ padding: 28 }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Customer & Due Date */}
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
              <CustomerCombobox
                customers={customers}
                value={customerId}
                onChange={setCustomerId}
                loading={dataLoading}
              />
              {customers.length === 0 && !dataLoading && (
                <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 5 }}>
                  No customers yet.{" "}
                  <Link href="/crm" style={{ color: "#818cf8" }}>
                    Add one →
                  </Link>
                </p>
              )}
            </div>
            <div>
              <label className="label">Due Date *</label>
              <input
                type="date"
                className="input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>

          {/* ── Line Items ── */}
          <div style={{ marginBottom: 24 }}>
            {/* Column headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "170px 1fr 70px 120px 60px 90px 36px",
                gap: 8,
                marginBottom: 6,
                paddingLeft: 4,
              }}
            >
              {[
                "Catalog Item",
                "Description",
                "Qty",
                "Unit Price",
                "Tax%",
                "Amount",
                "",
              ].map((h, i) => (
                <span
                  key={i}
                  className="label"
                  style={{ marginBottom: 0, fontSize: 10 }}
                >
                  {h}
                </span>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lineItems.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "170px 1fr 70px 120px 60px 90px 36px",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  {/* Catalog picker */}
                  <ItemPicker
                    items={inventoryItems}
                    selectedId={item.itemId}
                    onSelect={(inv) => handleItemSelect(item.id, inv)}
                  />

                  {/* Description */}
                  <input
                    className="input"
                    placeholder="Description…"
                    value={item.description}
                    onChange={(e) =>
                      updateLineItem(item.id, { description: e.target.value })
                    }
                  />

                  {/* Qty */}
                  <input
                    type="number"
                    className="input"
                    min={0.01}
                    step={0.01}
                    value={item.quantity}
                    onChange={(e) =>
                      updateLineItem(item.id, {
                        quantity: parseFloat(e.target.value) || 0,
                      })
                    }
                  />

                  {/* Unit Price */}
                  <input
                    type="number"
                    className="input"
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                    value={item.unitPrice || ""}
                    onChange={(e) =>
                      updateLineItem(item.id, {
                        unitPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                  />

                  {/* Tax % */}
                  <input
                    type="number"
                    className="input"
                    placeholder="0"
                    min={0}
                    max={100}
                    step={0.5}
                    value={item.taxPercent || ""}
                    onChange={(e) =>
                      updateLineItem(item.id, {
                        taxPercent: parseFloat(e.target.value) || 0,
                      })
                    }
                  />

                  {/* Amount (computed) */}
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      textAlign: "right",
                      padding: "9px 0",
                    }}
                  >
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </div>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => removeLineItem(item.id)}
                    disabled={lineItems.length === 1}
                    style={{
                      background: "none",
                      border: "none",
                      cursor:
                        lineItems.length === 1 ? "not-allowed" : "pointer",
                      color:
                        lineItems.length === 1 ? "var(--text-muted)" : "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      padding: 0,
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </div>

            <button
              type="button"
              onClick={addLineItem}
              className="btn-ghost"
              style={{ marginTop: 12, gap: 6, fontSize: 13 }}
            >
              <Plus size={14} /> Add line item
            </button>
          </div>

          {/* ── Tax Rate & Notes ── */}
          <div
            style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 16 }}
          >
            <div>
              <label className="label">Invoice Tax Rate (%)</label>
              <input
                type="number"
                className="input"
                min={0}
                max={100}
                step={0.5}
                value={taxRate}
                onChange={(e) =>
                  setTaxRate(parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <input
                className="input"
                placeholder="Payment terms, instructions, or any notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* SKU summary */}
          {lineItems.some((i) => i.sku) && (
            <div
              style={{
                marginTop: 16,
                padding: "10px 14px",
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.15)",
                borderRadius: 8,
                fontSize: 11,
                color: "var(--text-secondary)",
              }}
            >
              <strong style={{ color: "#818cf8" }}>Linked catalog items:</strong>{" "}
              {lineItems
                .filter((i) => i.sku)
                .map((i) => `${i.description} (${i.sku})`)
                .join(", ")}
              {" — stock will be deducted automatically on payment."}
            </div>
          )}
        </motion.div>

        {/* ─────────────── Right — Summary ─────────────── */}
        <motion.div
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
        >
          {/* Summary card */}
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
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                    }}
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
              disabled={saving || dataLoading}
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Send size={15} /> Send Invoice
                </>
              )}
            </button>
            <button
              className="btn-ghost"
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "11px",
              }}
              onClick={() => handleSubmit("DRAFT")}
              disabled={saving || dataLoading}
            >
              <Save size={15} />
              Save as Draft
            </button>
          </div>

          {/* Line items breakdown */}
          {lineItems.some((i) => i.description && i.unitPrice > 0) && (
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
              {lineItems
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
                    <div
                      style={{
                        flex: 1,
                        paddingRight: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          display: "block",
                        }}
                      >
                        {item.description}
                      </span>
                      {item.sku && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                          }}
                        >
                          SKU: {item.sku}
                        </span>
                      )}
                    </div>
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

              {/* PDF hint */}
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                <FileText size={12} />
                PDF will be generated automatically on save.
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
