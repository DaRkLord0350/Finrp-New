"use client";

import { CreditCard } from "lucide-react";
import { PAYMENT_TERMS } from "@/lib/invoices/payment-terms";
import type { InvoiceFormApi } from "../hooks/use-invoice-form";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"];

export function PaymentSettingsSection({ form }: { form: InvoiceFormApi }) {
  const termLabel = PAYMENT_TERMS.find((t) => t.value === form.paymentTerms)?.label ?? form.paymentTerms;

  return (
    <div className="surface" style={{ padding: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <CreditCard size={15} /> Payment Settings
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label className="label">Currency</label>
          <select className="input" value={form.currency} onChange={(e) => form.setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Payment Terms</label>
          <input className="input" value={termLabel} disabled style={{ opacity: 0.7 }} title="Set under Customer Information" />
        </div>
      </div>

      <div>
        <label className="label">Payment Instructions / Terms &amp; Conditions</label>
        <textarea
          className="input"
          rows={2}
          value={form.terms}
          onChange={(e) => form.setTerms(e.target.value)}
          placeholder="Bank / UPI details, late-fee policy, payment terms…"
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />
      </div>
    </div>
  );
}
