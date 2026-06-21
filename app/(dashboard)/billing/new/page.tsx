"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Loader2, FileText } from "lucide-react";
import Link from "next/link";
import { useInvoiceForm } from "@/features/billing/hooks/use-invoice-form";
import { CustomerInfoSection } from "@/features/billing/components/customer-info-section";
import { LineItemsTable } from "@/features/billing/components/line-items-table";
import { NotesSection } from "@/features/billing/components/notes-section";
import { AttachmentsSection } from "@/features/billing/components/attachments-section";
import { RecurringSection } from "@/features/billing/components/recurring-section";
import { PaymentSettingsSection } from "@/features/billing/components/payment-settings-section";
import { CalcPanel } from "@/features/billing/components/calc-panel";
import { InvoiceSuccessScreen } from "@/features/billing/components/invoice-success";
import InvoicePreview, { type PreviewInvoiceData } from "@/components/billing/InvoicePreview";
import { useBreakpoint } from "@/hooks/useBreakpoint";

export default function NewInvoicePage() {
  const form = useInvoiceForm();
  const { isMobile, isTablet } = useBreakpoint();
  const stacked = isMobile || isTablet;

  const selectedCustomer = form.customers.find((c) => c.id === form.customerId);
  const selectedSection = form.sections.find((s) => s.id === form.tdsTcsSectionId);

  const previewData: PreviewInvoiceData = useMemo(() => {
    const t = form.totals;
    const tdsTcsLabel = form.tdsTcsType
      ? `${form.tdsTcsType}${selectedSection ? ` ${selectedSection.code}` : ""} (${form.tdsTcsRate}%)`
      : null;
    return {
      invoiceNumber: form.invoiceNumber || "INV-DRAFT",
      status: "DRAFT",
      issueDate: form.issueDate || new Date().toISOString(),
      dueDate: form.dueDate || new Date().toISOString(),
      currency: form.currency,
      business: {
        name: form.profile.businessName ?? "Your Company",
        address: form.profile.address ?? null,
        cityLine: [form.profile.city, form.profile.state, form.profile.country].filter(Boolean).join(", ") || null,
        gstin: form.profile.gstin ?? null,
        pan: form.profile.pan ?? null,
        email: null,
        phone: form.profile.phone ?? null,
        website: form.profile.websiteUrl ?? null,
        logoUrl: form.appearance.logoUrl ?? form.profile.logoUrl ?? null,
      },
      customer: {
        name: selectedCustomer?.name ?? "—",
        company: selectedCustomer?.company ?? null,
        email: selectedCustomer?.email ?? null,
        phone: selectedCustomer?.phone ?? null,
        address: selectedCustomer?.address ?? null,
        gstin: selectedCustomer?.gstin ?? null,
      },
      items: form.lineItems.map((i) => ({
        description: i.description || "—",
        sku: i.sku ?? null,
        hsnSac: i.hsnSac ?? null,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount ?? 0,
        taxPercent: i.taxPercent,
        amount: i.quantity * i.unitPrice,
      })),
      subtotal: t.subtotal,
      discount: t.invoiceDiscount,
      shipping: t.shipping,
      adjustment: t.adjustment,
      roundOff: t.roundOff,
      taxRate: t.effectiveTaxRate,
      taxAmount: t.taxAmount,
      tdsTcsType: form.tdsTcsType,
      tdsTcsAmount: t.tdsTcsAmount,
      tdsTcsLabel,
      total: t.grandTotal,
      paidAmount: 0,
      balanceDue: t.grandTotal,
      customFields: form.customFields.filter((f) => f.label.trim()),
      notes: form.notes || null,
      terms: form.terms || null,
    };
  }, [form.totals, form.invoiceNumber, form.issueDate, form.dueDate, form.currency, form.profile, form.appearance, selectedCustomer, selectedSection, form.tdsTcsType, form.tdsTcsRate, form.lineItems, form.customFields, form.notes, form.terms]);

  if (form.success) return <InvoiceSuccessScreen success={form.success} onNewInvoice={form.reset} />;

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
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
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

      <div style={{ display: "grid", gridTemplateColumns: stacked ? "1fr" : "minmax(0, 1.25fr) minmax(340px, 0.75fr)", gap: 20, alignItems: "start" }}>
        {/* Left — form sections */}
        <motion.div style={{ display: "flex", flexDirection: "column", gap: 20 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <CustomerInfoSection form={form} />

          <div className="surface" style={{ padding: 24 }}>
            <LineItemsTable
              lineItems={form.lineItems}
              inventoryItems={form.inventoryItems}
              currency={form.currency}
              onAdd={form.addLineItem}
              onRemove={form.removeLineItem}
              onUpdate={form.updateLineItem}
              onItemSelect={form.handleItemSelect}
              onReorder={form.setLineItems}
              onBulkAdd={form.bulkAddItems}
              onCreateInline={form.createInlineItem}
            />
          </div>

          <NotesSection form={form} />
          <AttachmentsSection form={form} />
          <RecurringSection form={form} />
          <PaymentSettingsSection form={form} />
        </motion.div>

        {/* Right — calc panel + live preview */}
        <motion.div
          style={{ display: "flex", flexDirection: "column", gap: 20, position: stacked ? "static" : "sticky", top: 16 }}
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 }}
        >
          <CalcPanel form={form} />

          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <FileText size={12} /> Live Preview
            </p>
            <InvoicePreview appearance={form.appearance} data={previewData} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
