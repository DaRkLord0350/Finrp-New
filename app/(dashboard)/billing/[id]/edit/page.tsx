"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2, AlertCircle, FileText, X, Plus } from "lucide-react";
import { CustomerCombobox } from "@/features/billing/components/customer-combobox";
import { LineItemsTable } from "@/features/billing/components/line-items-table";
import type { Customer, InventoryItem, LineItem } from "@/features/billing/types";
import InvoicePreview, { type PreviewInvoiceData } from "@/components/billing/InvoicePreview";
import { DEFAULT_APPEARANCE, type InvoiceAppearance } from "@/lib/invoices/appearance-defaults";
import { formatCurrency } from "@/lib/formatters/currency";
import { useBreakpoint } from "@/hooks/useBreakpoint";

interface FullCustomer extends Customer {
  address?: string | null;
  gstin?: string | null;
}

interface BusinessProfile {
  businessName?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  gstin?: string | null;
  pan?: string | null;
  websiteUrl?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
}

export default function EditInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState<FullCustomer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [appearance, setAppearance] = useState<InvoiceAppearance>(DEFAULT_APPEARANCE);
  const [profile, setProfile] = useState<BusinessProfile>({});

  // Editable invoice fields
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [issueDate, setIssueDate] = useState<string>("");
  const [paidAmount, setPaidAmount] = useState(0);
  const [currency, setCurrency] = useState("INR");
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState(18);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [customFields, setCustomFields] = useState<Array<{ label: string; value: string }>>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [invRes, custRes, itemsRes, apprRes, orgRes] = await Promise.all([
          fetch(`/api/invoices/${invoiceId}`),
          fetch("/api/customers?take=100"),
          fetch("/api/items"),
          fetch("/api/settings/invoice-appearance"),
          fetch("/api/settings/organization"),
        ]);
        if (!invRes.ok) throw new Error(invRes.status === 404 ? "Invoice not found" : "Failed to load invoice");
        const inv = await invRes.json();
        const custData = await custRes.json().catch(() => ({}));
        const itemsData = await itemsRes.json().catch(() => ({}));
        const apprData = await apprRes.json().catch(() => ({}));
        const orgData = await orgRes.json().catch(() => ({}));
        if (cancelled) return;

        setCustomers(Array.isArray(custData) ? custData : (custData.data ?? custData.customers ?? []));
        setInventory(Array.isArray(itemsData) ? itemsData : (itemsData.items ?? []));
        if (apprData.appearance) setAppearance(apprData.appearance);
        if (orgData.profile) setProfile(orgData.profile);

        setInvoiceNumber(inv.invoiceNumber);
        setStatus(inv.status);
        setIssueDate(inv.issueDate);
        setPaidAmount(Number(inv.paidAmount));
        setCurrency(inv.currency ?? "INR");
        setCustomerId(inv.customerId);
        setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "");
        setTaxRate(Number(inv.taxRate));
        setDiscount(Number(inv.discount));
        setShipping(Number(inv.shipping));
        setNotes(inv.notes ?? "");
        setTerms(inv.terms ?? "");
        setInternalNotes(inv.internalNotes ?? "");
        setCustomFields(Array.isArray(inv.customFields) ? inv.customFields : []);
        setLineItems(
          (inv.items ?? []).map((it: Record<string, unknown>) => ({
            id: String(it.id),
            itemId: undefined,
            sku: (it.sku as string) ?? undefined,
            hsnSac: (it.hsnSac as string) ?? undefined,
            description: String(it.description ?? ""),
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            taxPercent: Number(it.taxPercent),
          }))
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  // ── Line item helpers ─────────────────────────────────────
  const addLineItem = () =>
    setLineItems((prev) => [...prev, { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0, taxPercent: taxRate }]);
  const removeLineItem = (id: string) =>
    setLineItems((prev) => (prev.length === 1 ? prev : prev.filter((i) => i.id !== id)));
  const updateLineItem = (id: string, updates: Partial<LineItem>) =>
    setLineItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  const handleItemSelect = (lineId: string, inv: InventoryItem | null) => {
    if (!inv) {
      updateLineItem(lineId, { itemId: undefined, sku: undefined });
    } else {
      updateLineItem(lineId, {
        itemId: inv.id,
        sku: inv.sku ?? undefined,
        description: inv.name,
        unitPrice: Number(inv.sellingPrice),
        taxPercent: Number(inv.taxRate),
      });
    }
  };

  const addCustomField = () => setCustomFields((prev) => [...prev, { label: "", value: "" }]);
  const removeCustomField = (idx: number) => setCustomFields((prev) => prev.filter((_, i) => i !== idx));
  const setCustomField = (idx: number, key: "label" | "value", val: string) =>
    setCustomFields((prev) => prev.map((f, i) => (i === idx ? { ...f, [key]: val } : f)));

  // ── Totals ────────────────────────────────────────────────
  const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount + shipping - discount;
  const balanceDue = Math.max(0, total - paidAmount);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  // ── Live preview data ─────────────────────────────────────
  const previewData: PreviewInvoiceData = useMemo(
    () => ({
      invoiceNumber: invoiceNumber || "INV-DRAFT",
      status,
      issueDate: issueDate || new Date().toISOString(),
      dueDate: dueDate || new Date().toISOString(),
      currency,
      business: {
        name: profile.businessName ?? "Your Company",
        address: profile.address ?? null,
        cityLine: [profile.city, profile.state, profile.country].filter(Boolean).join(", ") || null,
        gstin: profile.gstin ?? null,
        pan: profile.pan ?? null,
        email: null,
        phone: profile.phone ?? null,
        website: profile.websiteUrl ?? null,
        logoUrl: appearance.logoUrl ?? profile.logoUrl ?? null,
      },
      customer: {
        name: selectedCustomer?.name ?? "—",
        company: selectedCustomer?.company ?? null,
        email: selectedCustomer?.email ?? null,
        phone: selectedCustomer?.phone ?? null,
        address: selectedCustomer?.address ?? null,
        gstin: selectedCustomer?.gstin ?? null,
      },
      items: lineItems.map((i) => ({
        description: i.description || "—",
        sku: i.sku ?? null,
        hsnSac: i.hsnSac ?? null,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: 0,
        taxPercent: i.taxPercent,
        amount: i.quantity * i.unitPrice,
      })),
      subtotal,
      discount,
      shipping,
      taxRate,
      taxAmount,
      total,
      paidAmount,
      balanceDue,
      customFields: customFields.filter((f) => f.label.trim()),
      notes: notes || null,
      terms: terms || null,
    }),
    [invoiceNumber, status, issueDate, dueDate, currency, profile, appearance, selectedCustomer, lineItems, subtotal, discount, shipping, taxRate, taxAmount, total, paidAmount, balanceDue, customFields, notes, terms]
  );

  const handleSave = async () => {
    if (!customerId) return toast.error("Select a customer");
    if (!dueDate) return toast.error("Set a due date");
    const validItems = lineItems.filter((i) => i.description.trim() && i.unitPrice > 0);
    if (validItems.length === 0) return toast.error("Add at least one line item with a description and price");

    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          dueDate,
          taxRate,
          discount,
          shipping,
          currency,
          notes: notes.trim(),
          terms: terms.trim(),
          internalNotes: internalNotes.trim(),
          customFields: customFields.filter((f) => f.label.trim()),
          items: validItems.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            sku: i.sku,
            hsnSac: i.hsnSac,
            taxPercent: i.taxPercent,
          })),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to save");
      }
      toast.success("Invoice updated");
      router.push(`/billing/${invoiceId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 10, color: "var(--text-muted)" }}>
        <Loader2 size={18} className="animate-spin" /> Loading invoice…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 40 }}>
        <AlertCircle size={40} color="#ef4444" />
        <p style={{ color: "var(--text-primary)", fontWeight: 600 }}>{error}</p>
        <button onClick={() => router.push(`/billing/${invoiceId}`)} className="btn-ghost">Back to invoice</button>
      </div>
    );
  }

  const labelCls = "label";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.push(`/billing/${invoiceId}`)} className="btn-ghost" style={{ padding: "8px 12px", gap: 6 }}>
            <ArrowLeft size={15} /> Back
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Edit Invoice</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2, fontFamily: "monospace" }}>{invoiceNumber}</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-brand">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: stacked ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
        {/* Form */}
        <motion.div className="surface" style={{ padding: 24 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label className={labelCls}>Customer *</label>
              <CustomerCombobox customers={customers} value={customerId} onChange={setCustomerId} loading={false} />
            </div>
            <div>
              <label className={labelCls}>Due Date *</label>
              <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <LineItemsTable
            lineItems={lineItems}
            inventoryItems={inventory}
            onAdd={addLineItem}
            onRemove={removeLineItem}
            onUpdate={updateLineItem}
            onItemSelect={handleItemSelect}
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
            <div>
              <label className={labelCls}>Tax Rate (%)</label>
              <input type="number" className="input" min={0} max={100} step={0.5} value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={labelCls}>Discount</label>
              <input type="number" className="input" min={0} step={0.01} value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={labelCls}>Shipping</label>
              <input type="number" className="input" min={0} step={0.01} value={shipping} onChange={(e) => setShipping(parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className={labelCls}>Notes (customer-facing)</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ resize: "vertical", fontFamily: "inherit" }} placeholder="Payment instructions, thank-you note…" />
          </div>
          <div>
            <label className={labelCls}>Terms &amp; Conditions</label>
            <textarea className="input" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} style={{ resize: "vertical", fontFamily: "inherit" }} placeholder="Payment terms, late fees…" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, marginTop: 16 }}>
            <div>
              <label className={labelCls}>Currency</label>
              <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Internal Notes (private — not on PDF)</label>
              <input className="input" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Visible only to your team…" />
            </div>
          </div>

          {/* Custom fields */}
          <div style={{ marginTop: 16 }}>
            <label className={labelCls}>Custom Fields</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {customFields.map((f, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 34px", gap: 8 }}>
                  <input className="input" placeholder="Label (e.g. PO Number)" value={f.label} onChange={(e) => setCustomField(idx, "label", e.target.value)} />
                  <input className="input" placeholder="Value" value={f.value} onChange={(e) => setCustomField(idx, "value", e.target.value)} />
                  <button type="button" onClick={() => removeCustomField(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addCustomField} className="btn-ghost" style={{ alignSelf: "flex-start", fontSize: 13, gap: 6 }}>
                <Plus size={14} /> Add custom field
              </button>
            </div>
          </div>

          {/* Totals readout */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              ["Subtotal", subtotal],
              ["Tax", taxAmount],
              ["Shipping", shipping],
              ["Discount", -discount],
            ].map(([label, val]) => (
              <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)" }}>
                <span>{label}</span>
                <span>{formatCurrency(Number(val), currency)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>
              <span>Total</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </motion.div>

        {/* Live preview */}
        <div style={{ position: stacked ? "static" : "sticky", top: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={12} /> Live Preview
          </p>
          <InvoicePreview appearance={appearance} data={previewData} />
        </div>
      </div>
    </div>
  );
}
