"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Package,
  Tag,
  Boxes,
  AlertTriangle,
  RefreshCw,
  FileText,
  ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { getInvoiceStatusMeta } from "@/lib/invoice-status";

interface ItemDetail {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  unit: string | null;
  price: number;
  costPrice: number;
  taxRate: number;
  stock: number;
  lowStockAt: number;
  reorderLevel: number;
  createdAt: string;
  updatedAt: string;
}

interface AssociatedInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  createdAt: string;
  customerName: string | null;
}

function stockColor(stock: number, low: number) {
  if (stock < low) return "#ef4444";
  if (stock < low * 2) return "#f59e0b";
  return "#10b981";
}

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [invoices, setInvoices] = useState<AssociatedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/items/${itemId}`);
        if (res.status === 404) {
          if (!cancelled) setMissing(true);
          return;
        }
        if (!res.ok) throw new Error("Failed to load item");
        const data = await res.json();
        if (cancelled) return;
        setItem(data.item as ItemDetail);
        setInvoices((data.invoices ?? []) as AssociatedInvoice[]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  // Render the framework not-found UI for invalid / missing IDs.
  if (missing) notFound();

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 10, color: "var(--text-muted)" }}>
        <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
        Loading item…
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────
  if (error || !item) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <button
          onClick={() => router.push("/billing/items")}
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 14 }}
        >
          <ArrowLeft size={16} /> Back to Inventory
        </button>
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: 20, color: "#ef4444", display: "flex", alignItems: "center", gap: 12 }}>
          <AlertTriangle size={20} />
          <span>{error || "Item not found"}</span>
        </div>
      </div>
    );
  }

  const isLow = item.stock < item.lowStockAt;

  const detailRows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Price", value: formatCurrency(item.price) },
    { label: "Current Stock", value: <span style={{ color: stockColor(item.stock, item.lowStockAt), fontWeight: 700 }}>{item.stock}</span> },
    { label: "Low Stock Threshold", value: `${item.lowStockAt} units` },
    ...(item.sku ? [{ label: "SKU", value: <span style={{ fontFamily: "monospace" }}>{item.sku}</span> }] : []),
    ...(item.category ? [{ label: "Category", value: item.category }] : []),
    ...(item.unit ? [{ label: "Unit", value: item.unit }] : []),
    { label: "Created At", value: formatDate(item.createdAt) },
    { label: "Updated At", value: formatDate(item.updatedAt) },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Back link */}
      <button
        onClick={() => router.push("/billing/items")}
        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 14 }}
      >
        <ArrowLeft size={16} /> Back to Inventory
      </button>

      {/* Header */}
      <motion.div
        className="surface"
        style={{ padding: 24, marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Package size={22} color="var(--brand-400)" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{item.name}</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
              {item.sku ? (
                <>
                  <Tag size={12} /> SKU {item.sku}
                </>
              ) : (
                "No SKU assigned"
              )}
            </p>
          </div>
        </div>
        {isLow && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
            <AlertTriangle size={13} /> Low stock
          </span>
        )}
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Details */}
        <motion.div
          className="surface"
          style={{ padding: 24 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Details</h2>

          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>Description</p>
            <p style={{ fontSize: 14, color: item.description ? "var(--text-primary)" : "var(--text-muted)", lineHeight: 1.5 }}>
              {item.description || "No description provided"}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {detailRows.map((row, idx) => (
              <div
                key={idx}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: idx < detailRows.length - 1 ? "1px solid var(--border)" : "none" }}
              >
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{row.label}</span>
                <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Stock snapshot */}
        <motion.div
          className="surface"
          style={{ padding: 24 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Stock</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: 16, textAlign: "center" }}>
              <Boxes size={20} color={stockColor(item.stock, item.lowStockAt)} style={{ marginBottom: 6 }} />
              <p style={{ fontSize: 28, fontWeight: 700, color: stockColor(item.stock, item.lowStockAt) }}>{item.stock}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>In Stock</p>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)" }}>
              <span>Low stock alert at</span>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.lowStockAt}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)" }}>
              <span>Unit price</span>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{formatCurrency(item.price)}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Associated invoices */}
      <motion.div
        className="surface"
        style={{ padding: 24 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={16} color="var(--text-muted)" /> Associated Invoices ({invoices.length})
        </h2>
        {invoices.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "28px 0" }}>
            {item.sku ? "This item hasn't appeared on any invoices yet." : "Assign a SKU to track this item across invoices."}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>Invoice</th>
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>Customer</th>
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>Date</th>
                  <th style={{ textAlign: "left", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>Status</th>
                  <th style={{ textAlign: "right", padding: 12, color: "var(--text-muted)", fontSize: 12, fontWeight: 500 }}>Total</th>
                  <th style={{ padding: 12 }}></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const meta = getInvoiceStatusMeta(inv.status);
                  return (
                    <tr key={inv.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: 12, color: "var(--text-primary)", fontSize: 13, fontWeight: 500, fontFamily: "monospace" }}>{inv.invoiceNumber}</td>
                      <td style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>{inv.customerName ?? "—"}</td>
                      <td style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>{formatDate(inv.createdAt)}</td>
                      <td style={{ padding: 12 }}>
                        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: meta.color, background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: 12, textAlign: "right", color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{formatCurrency(inv.total)}</td>
                      <td style={{ padding: 12, textAlign: "right" }}>
                        <Link href={`/billing/${inv.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#818cf8", textDecoration: "none" }}>
                          View <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
