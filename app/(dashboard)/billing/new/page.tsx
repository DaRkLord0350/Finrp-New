"use client";

import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useInvoiceForm } from "@/features/billing/hooks/use-invoice-form";
import { CustomerCombobox } from "@/features/billing/components/customer-combobox";
import { LineItemsTable } from "@/features/billing/components/line-items-table";
import { InvoiceSummary } from "@/features/billing/components/invoice-summary";
import { InvoiceSuccessScreen } from "@/features/billing/components/invoice-success";

export default function NewInvoicePage() {
  const form = useInvoiceForm();

  if (form.success)
    return <InvoiceSuccessScreen success={form.success} onNewInvoice={form.reset} />;

  if (form.dataError)
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 40 }}>
        <AlertCircle size={40} color="#ef4444" />
        <p style={{ color: "var(--text-primary)", fontWeight: 600 }}>{form.dataError}</p>
        <button onClick={() => window.location.reload()} className="btn-ghost">Retry</button>
      </div>
    );

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
        {form.dataLoading && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
            <Loader2 size={14} className="animate-spin" /> Loading data…
          </div>
        )}
      </div>

      {/* Validation error */}
      {form.submitError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: "10px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#ef4444", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}
        >
          <AlertCircle size={14} /> {form.submitError}
        </motion.div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        {/* Left — Invoice Form */}
        <motion.div className="surface" style={{ padding: 28 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {/* Customer & Due Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div>
              <label className="label">Customer *</label>
              <CustomerCombobox
                customers={form.customers}
                value={form.customerId}
                onChange={form.setCustomerId}
                loading={form.dataLoading}
              />
              {form.customers.length === 0 && !form.dataLoading && (
                <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 5 }}>
                  No customers yet. <Link href="/crm" style={{ color: "#818cf8" }}>Add one →</Link>
                </p>
              )}
            </div>
            <div>
              <label className="label">Due Date *</label>
              <input
                type="date" className="input"
                value={form.dueDate}
                onChange={(e) => form.setDueDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>

          {/* Line Items */}
          <LineItemsTable
            lineItems={form.lineItems}
            inventoryItems={form.inventoryItems}
            onAdd={form.addLineItem}
            onRemove={form.removeLineItem}
            onUpdate={form.updateLineItem}
            onItemSelect={form.handleItemSelect}
          />

          {/* Tax & Notes */}
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 16 }}>
            <div>
              <label className="label">Invoice Tax Rate (%)</label>
              <input
                type="number" className="input"
                min={0} max={100} step={0.5}
                value={form.taxRate}
                onChange={(e) => form.setTaxRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <input
                className="input"
                placeholder="Payment terms, instructions…"
                value={form.notes}
                onChange={(e) => form.setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* SKU summary */}
          {form.lineItems.some((i) => i.sku) && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8, fontSize: 11, color: "var(--text-secondary)" }}>
              <strong style={{ color: "#818cf8" }}>Linked catalog items:</strong>{" "}
              {form.lineItems.filter((i) => i.sku).map((i) => `${i.description} (${i.sku})`).join(", ")}
              {" — stock will be deducted automatically on payment."}
            </div>
          )}
        </motion.div>

        {/* Right — Summary & Actions */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
          <InvoiceSummary
            subtotal={form.subtotal}
            taxAmount={form.taxAmount}
            total={form.total}
            taxRate={form.taxRate}
            lineItems={form.lineItems}
            saving={form.saving}
            dataLoading={form.dataLoading}
            onSubmit={form.handleSubmit}
          />
        </motion.div>
      </div>
    </div>
  );
}
