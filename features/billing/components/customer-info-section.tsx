"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { CustomerCombobox } from "./customer-combobox";
import { PAYMENT_TERMS } from "@/lib/invoices/payment-terms";
import type { InvoiceFormApi } from "../hooks/use-invoice-form";

export function CustomerInfoSection({ form }: { form: InvoiceFormApi }) {
  return (
    <div className="surface" style={{ padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Customer Information</h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label className="label">Customer *</label>
          <CustomerCombobox customers={form.customers} value={form.customerId} onChange={form.setCustomerId} loading={form.dataLoading} />
          {form.customers.length === 0 && !form.dataLoading && (
            <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 5 }}>
              No customers yet. <Link href="/crm" style={{ color: "#818cf8" }}>Add one →</Link>
            </p>
          )}
        </div>
        <div>
          <label className="label">Invoice Number</label>
          <div style={{ position: "relative" }}>
            <input
              className="input"
              placeholder="Auto-generated (INV-YYYY-…)"
              value={form.invoiceNumber}
              onChange={(e) => form.setInvoiceNumber(e.target.value)}
              style={{ paddingRight: 30 }}
            />
            {!form.invoiceNumber && (
              <Sparkles size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label className="label">Invoice Date</label>
          <input type="date" className="input" value={form.issueDate} onChange={(e) => form.setIssueDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Payment Terms</label>
          <select className="input" value={form.paymentTerms} onChange={(e) => form.setPaymentTerms(e.target.value)}>
            {PAYMENT_TERMS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Due Date *</label>
          <input
            type="date"
            className="input"
            value={form.dueDate}
            onChange={(e) => form.setDueDate(e.target.value)}
            disabled={form.paymentTerms !== "CUSTOM"}
            style={{ opacity: form.paymentTerms !== "CUSTOM" ? 0.7 : 1 }}
            title={form.paymentTerms !== "CUSTOM" ? "Auto-calculated from payment terms" : undefined}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label className="label">Salesperson</label>
          <input className="input" placeholder="Name" value={form.salesperson} onChange={(e) => form.setSalesperson(e.target.value)} />
        </div>
        <div>
          <label className="label">Order Number</label>
          <input className="input" placeholder="SO-…" value={form.orderNumber} onChange={(e) => form.setOrderNumber(e.target.value)} />
        </div>
        <div>
          <label className="label">Reference Number</label>
          <input className="input" placeholder="Ref…" value={form.referenceNumber} onChange={(e) => form.setReferenceNumber(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Subject</label>
        <input className="input" placeholder="Let your customer know what this invoice is for" value={form.subject} onChange={(e) => form.setSubject(e.target.value)} />
      </div>
    </div>
  );
}
