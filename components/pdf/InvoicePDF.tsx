// Server-only component — only imported by lib/pdf/generateInvoicePdf.ts
// Do NOT import this in any client component or page.

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface InvoicePDFItem {
  description: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  amount: number;
}

export interface InvoicePDFData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  status: string;
  notes?: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  shipping: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  items: InvoicePDFItem[];
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    address?: string | null;
    gstin?: string | null;
  };
  business: {
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    taxId?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    website?: string | null;
    logoUrl?: string | null;
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const BRAND = "#6366f1";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const BG_LIGHT = "#f9fafb";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: TEXT,
    backgroundColor: "#ffffff",
    padding: 40,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
    paddingBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
  },
  logoBox: {
    flexDirection: "column",
    gap: 4,
  },
  logo: {
    width: 48,
    height: 48,
    marginBottom: 6,
  },
  companyName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: TEXT,
  },
  companyDetail: {
    fontSize: 9,
    color: MUTED,
    marginTop: 2,
  },
  invoiceTitle: {
    alignItems: "flex-end",
  },
  invoiceLabel: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    letterSpacing: 1,
  },
  invoiceNumber: {
    fontSize: 11,
    color: MUTED,
    marginTop: 4,
  },
  statusBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: BRAND,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Parties
  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
    gap: 24,
  },
  partyBox: {
    flex: 1,
    padding: 14,
    backgroundColor: BG_LIGHT,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  partyLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  partyName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: TEXT,
    marginBottom: 4,
  },
  partyDetail: {
    fontSize: 9,
    color: MUTED,
    marginBottom: 2,
  },
  // Meta row
  metaRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  metaBox: {
    flex: 1,
    padding: 12,
    backgroundColor: BG_LIGHT,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: TEXT,
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BRAND,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowAlt: {
    backgroundColor: BG_LIGHT,
  },
  tableCell: {
    fontSize: 9,
    color: TEXT,
  },
  tableCellMuted: {
    fontSize: 8,
    color: MUTED,
    marginTop: 1,
  },
  // Column widths
  colDescription: { flex: 3 },
  colSku: { flex: 1.2 },
  colQty: { flex: 0.8, textAlign: "right" },
  colPrice: { flex: 1.2, textAlign: "right" },
  colTax: { flex: 0.8, textAlign: "right" },
  colAmount: { flex: 1.2, textAlign: "right" },
  // Totals
  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
    marginBottom: 24,
  },
  totalsBox: {
    width: 240,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  totalsLabel: {
    fontSize: 9,
    color: MUTED,
  },
  totalsValue: {
    fontSize: 9,
    color: TEXT,
    fontFamily: "Helvetica-Bold",
  },
  totalGrandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    backgroundColor: BRAND,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginTop: 4,
  },
  totalGrandLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  totalGrandValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  balanceDueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: BRAND,
    borderRadius: 4,
  },
  // Notes
  notesSection: {
    marginTop: 8,
    padding: 14,
    backgroundColor: BG_LIGHT,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  notesLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    color: TEXT,
    lineHeight: 1.5,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: MUTED,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(value: number, currency: string) {
  return `${currency === "INR" ? "₹" : "$"}${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function InvoicePDF({ data }: { data: InvoicePDFData }) {
  const { invoice: _inv, ..._ } = { invoice: data }; // unused — just for clarity
  const curr = data.currency;

  return (
    <Document
      title={`Invoice ${data.invoiceNumber}`}
      author={data.business.name}
      subject="Invoice"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            {data.business.logoUrl && (
              <Image src={data.business.logoUrl} style={styles.logo} />
            )}
            <Text style={styles.companyName}>{data.business.name}</Text>
            {data.business.address && (
              <Text style={styles.companyDetail}>{data.business.address}</Text>
            )}
            {(data.business.city || data.business.state) && (
              <Text style={styles.companyDetail}>
                {[data.business.city, data.business.state, data.business.country]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
            )}
            {data.business.taxId && (
              <Text style={styles.companyDetail}>GSTIN: {data.business.taxId}</Text>
            )}
            {data.business.contactEmail && (
              <Text style={styles.companyDetail}>{data.business.contactEmail}</Text>
            )}
          </View>

          <View style={styles.invoiceTitle}>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{data.status}</Text>
            </View>
          </View>
        </View>

        {/* ── Date meta ── */}
        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Issue Date</Text>
            <Text style={styles.metaValue}>{fmtDate(data.issueDate)}</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Due Date</Text>
            <Text style={styles.metaValue}>{fmtDate(data.dueDate)}</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Amount Due</Text>
            <Text style={[styles.metaValue, { color: BRAND }]}>
              {fmt(data.balanceDue, curr)}
            </Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Currency</Text>
            <Text style={styles.metaValue}>{curr}</Text>
          </View>
        </View>

        {/* ── Bill From / To ── */}
        <View style={styles.parties}>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>From</Text>
            <Text style={styles.partyName}>{data.business.name}</Text>
            {data.business.taxId && (
              <Text style={styles.partyDetail}>GST: {data.business.taxId}</Text>
            )}
            {data.business.contactPhone && (
              <Text style={styles.partyDetail}>{data.business.contactPhone}</Text>
            )}
            {data.business.website && (
              <Text style={styles.partyDetail}>{data.business.website}</Text>
            )}
          </View>

          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>Bill To</Text>
            <Text style={styles.partyName}>{data.customer.name}</Text>
            {data.customer.company && (
              <Text style={styles.partyDetail}>{data.customer.company}</Text>
            )}
            {data.customer.email && (
              <Text style={styles.partyDetail}>{data.customer.email}</Text>
            )}
            {data.customer.phone && (
              <Text style={styles.partyDetail}>{data.customer.phone}</Text>
            )}
            {data.customer.address && (
              <Text style={styles.partyDetail}>{data.customer.address}</Text>
            )}
            {data.customer.gstin && (
              <Text style={styles.partyDetail}>GSTIN: {data.customer.gstin}</Text>
            )}
          </View>
        </View>

        {/* ── Items Table ── */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colDescription]}>
            Description
          </Text>
          <Text style={[styles.tableHeaderCell, styles.colSku]}>SKU</Text>
          <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
          <Text style={[styles.tableHeaderCell, styles.colPrice]}>Unit Price</Text>
          <Text style={[styles.tableHeaderCell, styles.colTax]}>Tax%</Text>
          <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
        </View>

        {data.items.map((item, i) => (
          <View
            key={i}
            style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            <View style={styles.colDescription}>
              <Text style={styles.tableCell}>{item.description}</Text>
            </View>
            <Text style={[styles.tableCell, styles.colSku]}>{item.sku ?? "—"}</Text>
            <Text style={[styles.tableCell, styles.colQty]}>
              {Number(item.quantity).toFixed(2)}
            </Text>
            <Text style={[styles.tableCell, styles.colPrice]}>
              {fmt(Number(item.unitPrice), curr)}
            </Text>
            <Text style={[styles.tableCell, styles.colTax]}>
              {Number(item.taxPercent).toFixed(1)}%
            </Text>
            <Text style={[styles.tableCell, styles.colAmount]}>
              {fmt(Number(item.amount), curr)}
            </Text>
          </View>
        ))}

        {/* ── Totals ── */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{fmt(data.subtotal, curr)}</Text>
            </View>
            {Number(data.discount) > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Discount</Text>
                <Text style={styles.totalsValue}>
                  − {fmt(Number(data.discount), curr)}
                </Text>
              </View>
            )}
            {Number(data.shipping) > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Shipping</Text>
                <Text style={styles.totalsValue}>{fmt(Number(data.shipping), curr)}</Text>
              </View>
            )}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                Tax ({Number(data.taxRate).toFixed(1)}%)
              </Text>
              <Text style={styles.totalsValue}>{fmt(data.taxAmount, curr)}</Text>
            </View>

            <View style={styles.totalGrandRow}>
              <Text style={styles.totalGrandLabel}>Total</Text>
              <Text style={styles.totalGrandValue}>{fmt(data.total, curr)}</Text>
            </View>

            {Number(data.paidAmount) > 0 && (
              <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.totalsLabel}>Amount Paid</Text>
                <Text style={[styles.totalsValue, { color: "#16a34a" }]}>
                  {fmt(Number(data.paidAmount), curr)}
                </Text>
              </View>
            )}

            {Number(data.balanceDue) > 0 && (
              <View style={styles.balanceDueRow}>
                <Text style={[styles.totalsLabel, { color: BRAND, fontFamily: "Helvetica-Bold" }]}>
                  Balance Due
                </Text>
                <Text style={[styles.totalsValue, { color: BRAND }]}>
                  {fmt(data.balanceDue, curr)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Notes ── */}
        {data.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.business.name} · {data.invoiceNumber}
          </Text>
          <Text style={styles.footerText}>
            Generated by FINRP · {fmtDate(new Date())}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
