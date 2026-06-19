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
import { DEFAULT_APPEARANCE, type InvoiceAppearance } from "@/lib/invoices/appearance-defaults";
import { getTheme, type InvoiceThemeDef } from "@/lib/invoices/themes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface InvoicePDFItem {
  description: string;
  sku?: string | null;
  hsnSac?: string | null;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxPercent: number;
  amount: number;
}

export interface InvoicePDFData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  status: string;
  notes?: string | null;
  terms?: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  shipping: number;
  adjustment?: number;
  roundOff?: number;
  taxRate: number;
  taxAmount: number;
  tdsTcsType?: "TDS" | "TCS" | null;
  tdsTcsAmount?: number;
  tdsTcsLabel?: string | null;
  total: number;
  paidAmount: number;
  balanceDue: number;
  customFields?: Array<{ label: string; value: string }> | null;
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
    gstin?: string | null;
    pan?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    website?: string | null;
    logoUrl?: string | null;
  };
}

// react-pdf only ships these standard families; pick the matching bold face.
function resolveFonts(family: string) {
  switch (family) {
    case "Times-Roman":
      return { regular: "Times-Roman", bold: "Times-Bold" };
    case "Courier":
      return { regular: "Courier", bold: "Courier-Bold" };
    default:
      return { regular: "Helvetica", bold: "Helvetica-Bold" };
  }
}

// Build the stylesheet from appearance + theme tokens.
function makeStyles(a: InvoiceAppearance, theme: InvoiceThemeDef, accent: string) {
  const { regular, bold } = resolveFonts(a.fontFamily);
  const r = Math.max(0, Math.min(a.borderRadius ?? 8, 16));
  const TEXT = theme.text;
  const MUTED = theme.muted;
  const BORDER = theme.border;
  const SURFACE = theme.surfaceBg;

  return StyleSheet.create({
    page: { fontFamily: regular, fontSize: 10, color: TEXT, backgroundColor: theme.pageBg, padding: 40 },

    watermark: {
      position: "absolute",
      top: 280,
      left: 60,
      right: 60,
      textAlign: "center",
      fontFamily: bold,
      fontSize: 90,
      color: accent,
      opacity: 0.06,
      transform: "rotate(-24deg)",
    },

    // Header — bleed band variant
    headerBand: {
      marginTop: -40,
      marginLeft: -40,
      marginRight: -40,
      marginBottom: 24,
      paddingTop: 40,
      paddingBottom: 22,
      paddingHorizontal: 40,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    // Header — inline (bar / line) variant
    headerInline: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 26,
      paddingBottom: 20,
    },
    logoBox: { flexDirection: "column", maxWidth: 320 },
    logo: { width: 46, height: 46, marginBottom: 6, objectFit: "contain" },
    companyName: { fontSize: 17, fontFamily: bold },
    companyDetail: { fontSize: 9, marginTop: 2 },
    invoiceTitleBox: { alignItems: "flex-end" },
    invoiceLabel: { fontSize: 25, fontFamily: bold, letterSpacing: 1 },
    invoiceNumber: { fontSize: 10, marginTop: 4 },
    statusBadge: { marginTop: 8, paddingHorizontal: 10, paddingVertical: 3, borderRadius: r },
    statusText: { fontSize: 8, fontFamily: bold, textTransform: "uppercase", letterSpacing: 0.5 },
    dueStamp: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderRadius: r, alignSelf: "flex-end" },
    dueStampText: { fontSize: 8, fontFamily: bold, textTransform: "uppercase", letterSpacing: 0.5 },

    metaRow: { flexDirection: "row", gap: 10, marginBottom: 22 },
    metaBox: { flex: 1, padding: 10, borderRadius: r, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
    metaLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
    metaValue: { fontSize: 10, fontFamily: bold, color: TEXT },

    parties: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, gap: 16 },
    partyBox: { flex: 1, padding: theme.panels ? 14 : 0, borderRadius: r },
    partyLabel: { fontSize: 8, fontFamily: bold, color: accent, textTransform: theme.uppercaseLabels ? "uppercase" : "none", letterSpacing: theme.uppercaseLabels ? 1 : 0, marginBottom: 8 },
    partyName: { fontSize: 12, fontFamily: bold, color: TEXT, marginBottom: 4 },
    partyDetail: { fontSize: 9, color: MUTED, marginBottom: 2 },

    tableHeader: { flexDirection: "row", borderRadius: r, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 2 },
    tableHeaderCell: { fontSize: 8, fontFamily: bold, textTransform: "uppercase", letterSpacing: 0.3 },
    tableRow: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: BORDER },
    tableRowAlt: { backgroundColor: SURFACE },
    tableCell: { fontSize: 9, color: TEXT },
    tableCellMuted: { fontSize: 8, color: MUTED, marginTop: 1 },

    colIndex: { flex: 0.5 },
    colItem: { flex: 3 },
    colHsn: { flex: 1.1 },
    colQty: { flex: 0.8, textAlign: "right" },
    colPrice: { flex: 1.3, textAlign: "right" },
    colDisc: { flex: 1, textAlign: "right" },
    colTax: { flex: 0.8, textAlign: "right" },
    colAmount: { flex: 1.4, textAlign: "right" },

    totalsSection: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16, marginBottom: 20 },
    totalsBox: { width: 240 },
    totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: BORDER },
    totalsLabel: { fontSize: 9, color: MUTED },
    totalsValue: { fontSize: 9, color: TEXT, fontFamily: bold },
    grandRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 10, borderRadius: r, marginTop: 4 },
    grandLabel: { fontSize: 11, fontFamily: bold },
    grandValue: { fontSize: 13, fontFamily: bold },
    balanceDueRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, marginTop: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: accent, borderRadius: r },

    section: { marginTop: 8, padding: 14, backgroundColor: SURFACE, borderRadius: r, borderWidth: 1, borderColor: BORDER },
    sectionLabel: { fontSize: 8, fontFamily: bold, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
    sectionText: { fontSize: 9, color: TEXT, lineHeight: 1.5 },

    signatureBox: { marginTop: 28, alignItems: "flex-end" },
    signatureLine: { borderTopWidth: 1, borderTopColor: MUTED, paddingTop: 4, minWidth: 150, alignItems: "center" },
    signatureName: { fontSize: 9, color: TEXT },
    signatureLabel: { fontSize: 8, color: MUTED, marginTop: 1 },

    footer: { position: "absolute", bottom: 28, left: 40, right: 40, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    footerText: { fontSize: 8, color: MUTED },
  });
}

function fmt(value: number, currency: string) {
  return `${currency === "INR" ? "₹" : "$"}${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function InvoicePDF({ data, appearance }: { data: InvoicePDFData; appearance?: InvoiceAppearance }) {
  const a = appearance ?? DEFAULT_APPEARANCE;
  const theme = getTheme(a.template);
  const accent = a.accentColor || theme.accent;
  const styles = makeStyles(a, theme, accent);
  const curr = data.currency;

  const onDark = theme.header === "dark" || theme.header === "filled";
  const headerBandColor = theme.header === "dark" ? theme.darkBand : accent;
  const headerNameColor = onDark ? "#ffffff" : theme.text;
  const headerMutedColor = onDark ? "rgba(255,255,255,0.8)" : theme.muted;
  const titleColor = onDark ? "#ffffff" : accent;

  // Table header palette
  const tableHeadBg = theme.tableHeader === "accent" ? accent : theme.tableHeader === "dark" ? theme.darkBand : theme.surfaceBg;
  const tableHeadColor = theme.tableHeader === "soft" ? theme.muted : "#ffffff";
  const tableHeadBorder = theme.tableHeader === "soft" ? { borderWidth: 1, borderColor: theme.border } : {};

  // Grand-total palette
  const grandStyle =
    theme.totals === "outline"
      ? { backgroundColor: "transparent", borderWidth: 2, borderColor: accent }
      : { backgroundColor: theme.totals === "band" ? theme.darkBand : accent };
  const grandText = theme.totals === "outline" ? accent : "#ffffff";

  const watermark = a.watermarkText || (data.status === "DRAFT" && a.draftWatermark ? "DRAFT" : null);
  const showDueStamp = a.showDueStamp && data.balanceDue > 0 && data.status !== "PAID";
  const showHsn = data.items.some((it) => it.hsnSac);
  const customFields = (data.customFields ?? []).filter((f) => f && f.label);

  // Header inner content (shared by band + inline variants).
  const headerInner = (
    <>
      <View style={styles.logoBox}>
        {a.showLogo && data.business.logoUrl && (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={data.business.logoUrl} style={styles.logo} />
        )}
        <Text style={[styles.companyName, { color: headerNameColor }]}>{data.business.name}</Text>
        {data.business.address && <Text style={[styles.companyDetail, { color: headerMutedColor }]}>{data.business.address}</Text>}
        {(data.business.city || data.business.state) && (
          <Text style={[styles.companyDetail, { color: headerMutedColor }]}>
            {[data.business.city, data.business.state, data.business.country].filter(Boolean).join(", ")}
          </Text>
        )}
        {a.showGst && data.business.gstin && <Text style={[styles.companyDetail, { color: headerMutedColor }]}>GSTIN: {data.business.gstin}</Text>}
        {a.showPan && data.business.pan && <Text style={[styles.companyDetail, { color: headerMutedColor }]}>PAN: {data.business.pan}</Text>}
        {data.business.contactEmail && <Text style={[styles.companyDetail, { color: headerMutedColor }]}>{data.business.contactEmail}</Text>}
        {data.business.contactPhone && <Text style={[styles.companyDetail, { color: headerMutedColor }]}>{data.business.contactPhone}</Text>}
        {data.business.website && <Text style={[styles.companyDetail, { color: headerMutedColor }]}>{data.business.website}</Text>}
      </View>

      <View style={styles.invoiceTitleBox}>
        <Text style={[styles.invoiceLabel, { color: titleColor }]}>{a.invoiceTitle || "INVOICE"}</Text>
        <Text style={[styles.invoiceNumber, { color: headerMutedColor }]}>{data.invoiceNumber}</Text>
        <View style={[styles.statusBadge, { backgroundColor: onDark ? "rgba(255,255,255,0.18)" : accent }]}>
          <Text style={[styles.statusText, { color: "#ffffff" }]}>{data.status}</Text>
        </View>
        {showDueStamp && (
          <View style={[styles.dueStamp, { borderColor: onDark ? "rgba(255,255,255,0.6)" : accent }]}>
            <Text style={[styles.dueStampText, { color: onDark ? "#ffffff" : accent }]}>Due {fmt(data.balanceDue, curr)}</Text>
          </View>
        )}
      </View>
    </>
  );

  return (
    <Document title={`Invoice ${data.invoiceNumber}`} author={data.business.name} subject="Invoice">
      <Page size="A4" style={styles.page}>
        {watermark && (
          <Text style={styles.watermark} fixed>
            {watermark}
          </Text>
        )}

        {/* Header — band (filled/dark) or inline (bar/line) */}
        {onDark ? (
          <View style={[styles.headerBand, { backgroundColor: headerBandColor }]}>{headerInner}</View>
        ) : (
          <View
            style={[
              styles.headerInline,
              theme.header === "bar"
                ? { borderBottomWidth: 2, borderBottomColor: accent }
                : { borderBottomWidth: 1, borderBottomColor: theme.border },
            ]}
          >
            {headerInner}
          </View>
        )}

        {/* Date meta */}
        <View style={styles.metaRow}>
          {[
            { label: "Issue Date", value: fmtDate(data.issueDate) },
            { label: "Due Date", value: fmtDate(data.dueDate) },
            { label: "Amount Due", value: fmt(data.balanceDue, curr), accent: true },
            { label: "Currency", value: curr },
          ].map((m) => (
            <View key={m.label} style={[styles.metaBox, { backgroundColor: theme.panels ? theme.surfaceBg : "transparent" }]}>
              <Text style={styles.metaLabel}>{m.label}</Text>
              <Text style={[styles.metaValue, m.accent ? { color: accent } : {}]}>{m.value}</Text>
            </View>
          ))}
        </View>

        {/* Parties */}
        <View style={styles.parties}>
          <View style={[styles.partyBox, theme.panels ? { backgroundColor: theme.surfaceBg, borderWidth: 1, borderColor: theme.border } : {}]}>
            <Text style={styles.partyLabel}>From</Text>
            <Text style={styles.partyName}>{data.business.name}</Text>
            {a.showGst && data.business.gstin && <Text style={styles.partyDetail}>GSTIN: {data.business.gstin}</Text>}
            {a.showPan && data.business.pan && <Text style={styles.partyDetail}>PAN: {data.business.pan}</Text>}
            {data.business.contactPhone && <Text style={styles.partyDetail}>{data.business.contactPhone}</Text>}
            {data.business.website && <Text style={styles.partyDetail}>{data.business.website}</Text>}
          </View>

          <View style={[styles.partyBox, theme.panels ? { backgroundColor: theme.surfaceBg, borderWidth: 1, borderColor: theme.border } : {}]}>
            <Text style={styles.partyLabel}>Bill To</Text>
            <Text style={styles.partyName}>{data.customer.name}</Text>
            {data.customer.company && <Text style={styles.partyDetail}>{data.customer.company}</Text>}
            {data.customer.email && <Text style={styles.partyDetail}>{data.customer.email}</Text>}
            {data.customer.phone && <Text style={styles.partyDetail}>{data.customer.phone}</Text>}
            {data.customer.address && <Text style={styles.partyDetail}>{data.customer.address}</Text>}
            {a.showGst && data.customer.gstin && <Text style={styles.partyDetail}>GSTIN: {data.customer.gstin}</Text>}
          </View>
        </View>

        {/* Items Table */}
        <View style={[styles.tableHeader, { backgroundColor: tableHeadBg }, tableHeadBorder]}>
          <Text style={[styles.tableHeaderCell, styles.colIndex, { color: tableHeadColor }]}>#</Text>
          <Text style={[styles.tableHeaderCell, styles.colItem, { color: tableHeadColor }]}>Item</Text>
          {showHsn && <Text style={[styles.tableHeaderCell, styles.colHsn, { color: tableHeadColor }]}>HSN/SAC</Text>}
          <Text style={[styles.tableHeaderCell, styles.colQty, { color: tableHeadColor }]}>Qty</Text>
          <Text style={[styles.tableHeaderCell, styles.colPrice, { color: tableHeadColor }]}>Unit Price</Text>
          {a.showDiscountColumn && <Text style={[styles.tableHeaderCell, styles.colDisc, { color: tableHeadColor }]}>Disc</Text>}
          {a.showTaxColumn && <Text style={[styles.tableHeaderCell, styles.colTax, { color: tableHeadColor }]}>Tax%</Text>}
          <Text style={[styles.tableHeaderCell, styles.colAmount, { color: tableHeadColor }]}>Amount</Text>
        </View>

        {data.items.map((item, i) => (
          <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.tableCell, styles.colIndex]}>{i + 1}</Text>
            <View style={styles.colItem}>
              <Text style={styles.tableCell}>{item.description}</Text>
              {a.showItemDescription && item.sku && <Text style={styles.tableCellMuted}>SKU: {item.sku}</Text>}
            </View>
            {showHsn && <Text style={[styles.tableCell, styles.colHsn]}>{item.hsnSac || "—"}</Text>}
            <Text style={[styles.tableCell, styles.colQty]}>{Number(item.quantity).toFixed(2)}</Text>
            <Text style={[styles.tableCell, styles.colPrice]}>{fmt(Number(item.unitPrice), curr)}</Text>
            {a.showDiscountColumn && <Text style={[styles.tableCell, styles.colDisc]}>{item.discount ? fmt(Number(item.discount), curr) : "—"}</Text>}
            {a.showTaxColumn && <Text style={[styles.tableCell, styles.colTax]}>{Number(item.taxPercent).toFixed(1)}%</Text>}
            <Text style={[styles.tableCell, styles.colAmount]}>{fmt(Number(item.amount), curr)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{fmt(data.subtotal, curr)}</Text>
            </View>
            {Number(data.discount) > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Discount</Text>
                <Text style={styles.totalsValue}>{"− "}{fmt(Number(data.discount), curr)}</Text>
              </View>
            )}
            {a.showShipping && Number(data.shipping) > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Shipping</Text>
                <Text style={styles.totalsValue}>{fmt(Number(data.shipping), curr)}</Text>
              </View>
            )}
            {!!Number(data.adjustment) && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Adjustment</Text>
                <Text style={styles.totalsValue}>{(Number(data.adjustment) < 0 ? "− " : "+ ")}{fmt(Math.abs(Number(data.adjustment)), curr)}</Text>
              </View>
            )}
            {a.showTaxColumn && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Tax ({Number(data.taxRate).toFixed(1)}%)</Text>
                <Text style={styles.totalsValue}>{fmt(data.taxAmount, curr)}</Text>
              </View>
            )}
            {data.tdsTcsType && !!Number(data.tdsTcsAmount) && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>{data.tdsTcsLabel || data.tdsTcsType}</Text>
                <Text style={styles.totalsValue}>{(data.tdsTcsType === "TDS" ? "− " : "+ ")}{fmt(Number(data.tdsTcsAmount), curr)}</Text>
              </View>
            )}
            {!!Number(data.roundOff) && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Round Off</Text>
                <Text style={styles.totalsValue}>{(Number(data.roundOff) < 0 ? "− " : "+ ")}{fmt(Math.abs(Number(data.roundOff)), curr)}</Text>
              </View>
            )}

            <View style={[styles.grandRow, grandStyle]}>
              <Text style={[styles.grandLabel, { color: grandText }]}>Total</Text>
              <Text style={[styles.grandValue, { color: grandText }]}>{fmt(data.total, curr)}</Text>
            </View>

            {Number(data.paidAmount) > 0 && (
              <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.totalsLabel}>Amount Paid</Text>
                <Text style={[styles.totalsValue, { color: "#16a34a" }]}>{fmt(Number(data.paidAmount), curr)}</Text>
              </View>
            )}

            {Number(data.balanceDue) > 0 && (
              <View style={styles.balanceDueRow}>
                <Text style={[styles.totalsLabel, { color: accent, fontFamily: resolveFonts(a.fontFamily).bold }]}>Balance Due</Text>
                <Text style={[styles.totalsValue, { color: accent }]}>{fmt(data.balanceDue, curr)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Custom fields */}
        {customFields.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Additional Details</Text>
            {customFields.map((f, i) => (
              <Text key={i} style={styles.sectionText}>
                <Text style={{ fontFamily: resolveFonts(a.fontFamily).bold }}>{f.label}: </Text>
                {f.value}
              </Text>
            ))}
          </View>
        )}

        {/* Notes */}
        {a.showNotes && data.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.sectionText}>{data.notes}</Text>
          </View>
        )}

        {/* Terms */}
        {a.showTerms && data.terms && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Terms &amp; Conditions</Text>
            <Text style={styles.sectionText}>{data.terms}</Text>
          </View>
        )}

        {/* Signature */}
        {a.signatureText && (
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{a.signatureText}</Text>
              <Text style={styles.signatureLabel}>Authorized Signatory</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{a.footerText || "Generated securely by FinRP"}</Text>
          <Text style={styles.footerText}>
            {data.invoiceNumber} · {fmtDate(new Date())}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
