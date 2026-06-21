"use client";

// ============================================================
// Shared themed HTML invoice preview.
// Renders a real invoice (or sample data) in any of the 6 themes,
// honoring the org's appearance toggles. Used by the appearance
// studio's live split-preview and reusable elsewhere.
// ============================================================

import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { getInvoiceStatusMeta } from "@/lib/invoice-status";
import { getTheme } from "@/lib/invoices/themes";
import type { InvoiceAppearance } from "@/lib/invoices/appearance-defaults";

export interface PreviewItem {
  description: string;
  sku?: string | null;
  hsnSac?: string | null;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxPercent: number;
  amount: number;
}

export interface PreviewInvoiceData {
  invoiceNumber: string;
  status: string;
  issueDate: string | Date;
  dueDate: string | Date;
  currency: string;
  business: {
    name: string;
    address?: string | null;
    cityLine?: string | null;
    gstin?: string | null;
    pan?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    logoUrl?: string | null;
  };
  customer: {
    name: string;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    gstin?: string | null;
  };
  items: PreviewItem[];
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
  notes?: string | null;
  terms?: string | null;
}

// Realistic sample used by the appearance studio.
export const SAMPLE_INVOICE: PreviewInvoiceData = {
  invoiceNumber: "INV-2026-0042",
  status: "SENT",
  issueDate: "2026-06-01",
  dueDate: "2026-07-01",
  currency: "INR",
  business: {
    name: "Your Company Pvt. Ltd.",
    address: "123 Business Avenue",
    cityLine: "Mumbai, Maharashtra, India",
    gstin: "27ABCDE1234F1Z5",
    pan: "ABCDE1234F",
    email: "billing@yourcompany.com",
    phone: "+91 98765 43210",
    website: "www.yourcompany.com",
    logoUrl: null,
  },
  customer: {
    name: "Acme Corporation",
    company: "Acme Holdings",
    email: "accounts@acme.com",
    phone: "+91 91234 56780",
    address: "501 Tower B, Cyber City, Gurugram",
    gstin: "06AAACA1234A1Z1",
  },
  items: [
    { description: "Website Design & Development", sku: "SVC-WEB", hsnSac: "998314", quantity: 1, unitPrice: 120000, discount: 5000, taxPercent: 18, amount: 135700 },
    { description: "Monthly Maintenance Retainer", sku: "SVC-MNT", hsnSac: "998315", quantity: 3, unitPrice: 15000, discount: 0, taxPercent: 18, amount: 53100 },
    { description: "Premium Support Add-on", sku: "SVC-SUP", hsnSac: "998316", quantity: 1, unitPrice: 20000, discount: 0, taxPercent: 18, amount: 23600 },
  ],
  subtotal: 180000,
  discount: 5000,
  shipping: 0,
  taxRate: 18,
  taxAmount: 31500,
  total: 212400,
  paidAmount: 50000,
  balanceDue: 162400,
  customFields: [
    { label: "PO Number", value: "PO-88421" },
    { label: "Project", value: "Acme Web Revamp" },
  ],
  notes: "Thank you for your business. Payment is appreciated within the due date.",
  terms: "Payment due within 30 days. Late payments attract 1.5% monthly interest.",
};

function fontStack(font: string) {
  if (font === "Times-Roman") return "Georgia, 'Times New Roman', serif";
  if (font === "Courier") return "'Courier New', ui-monospace, monospace";
  return "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
}

export default function InvoicePreview({
  appearance,
  data,
  scale = 1,
  qrSrc,
}: {
  appearance: InvoiceAppearance;
  data: PreviewInvoiceData;
  scale?: number;
  /** Real QR image (data URL). When omitted, a decorative placeholder is shown. */
  qrSrc?: string | null;
}) {
  const theme = getTheme(appearance.template);
  const accent = appearance.accentColor || theme.accent;
  const radius = Math.max(0, Math.min(appearance.borderRadius ?? 8, 18));
  const meta = getInvoiceStatusMeta(data.status);
  const curr = data.currency;
  const money = (v: number) => formatCurrency(v, curr);
  const labelTransform = theme.uppercaseLabels ? ("uppercase" as const) : ("none" as const);

  const onDark = theme.header === "dark" || theme.header === "filled";
  const headerBg = theme.header === "dark" ? theme.darkBand : theme.header === "filled" ? accent : "transparent";
  const headerTextColor = onDark ? "#ffffff" : theme.text;
  const headerMuted = onDark ? "rgba(255,255,255,0.78)" : theme.muted;
  const titleColor = onDark ? "#ffffff" : accent;

  const tableHeadBg = theme.tableHeader === "accent" ? accent : theme.tableHeader === "dark" ? theme.darkBand : theme.surfaceBg;
  const tableHeadColor = theme.tableHeader === "soft" ? theme.muted : "#ffffff";

  const showHsn = data.items.some((i) => i.hsnSac);
  const customFields = (data.customFields ?? []).filter((f) => f && f.label);
  const numCols = new Set(["Qty", "Rate", "Disc", "Tax", "Amount"]);

  const cols: string[] = ["#", "Item"];
  if (showHsn) cols.push("HSN");
  cols.push("Qty", "Rate");
  if (appearance.showDiscountColumn) cols.push("Disc");
  if (appearance.showTaxColumn) cols.push("Tax");
  cols.push("Amount");
  const gridCols = `28px 1.6fr${showHsn ? " 0.8fr" : ""} 0.6fr 1fr${appearance.showDiscountColumn ? " 0.8fr" : ""}${appearance.showTaxColumn ? " 0.6fr" : ""} 1.1fr`;

  const labelStyle: React.CSSProperties = {
    fontSize: 8.5,
    fontWeight: 700,
    color: accent,
    textTransform: labelTransform,
    letterSpacing: theme.uppercaseLabels ? 1 : 0,
    marginBottom: 6,
  };

  return (
    <div
      style={{
        background: theme.pageBg,
        color: theme.text,
        fontFamily: fontStack(appearance.fontFamily),
        borderRadius: Math.max(radius, 8),
        border: `1px solid ${theme.border}`,
        boxShadow: "0 10px 40px rgba(0,0,0,0.10)",
        overflow: "hidden",
        position: "relative",
        fontSize: 11,
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "top center",
      }}
    >
      {/* Watermark */}
      {(appearance.watermarkText || (data.status === "DRAFT" && appearance.draftWatermark)) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            transform: "rotate(-26deg)",
            fontSize: 64,
            fontWeight: 800,
            color: accent,
            opacity: 0.07,
            letterSpacing: 4,
            whiteSpace: "nowrap",
            zIndex: 2,
          }}
        >
          {appearance.watermarkText || "DRAFT"}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          background: theme.header === "filled" ? `linear-gradient(135deg, ${accent}, ${accent}cc)` : headerBg,
          padding: 24,
          borderBottom:
            theme.header === "bar" ? `3px solid ${accent}` : theme.header === "line" ? `1px solid ${theme.border}` : "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", maxWidth: "62%" }}>
          {appearance.showLogo && (
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: Math.min(radius, 10),
                background: onDark ? "rgba(255,255,255,0.16)" : `${accent}1f`,
                border: `1px solid ${onDark ? "rgba(255,255,255,0.3)" : accent + "55"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: onDark ? "#fff" : accent,
                fontWeight: 800,
                fontSize: 15,
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {appearance.logoUrl || data.business.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(appearance.logoUrl || data.business.logoUrl) as string} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                data.business.name.charAt(0)
              )}
            </div>
          )}
          <div>
            <p style={{ fontWeight: 700, fontSize: 13, color: headerTextColor }}>{data.business.name}</p>
            {data.business.address && <p style={{ fontSize: 9.5, color: headerMuted }}>{data.business.address}</p>}
            {data.business.cityLine && <p style={{ fontSize: 9.5, color: headerMuted }}>{data.business.cityLine}</p>}
            {appearance.showGst && data.business.gstin && <p style={{ fontSize: 9.5, color: headerMuted }}>GSTIN: {data.business.gstin}</p>}
            {appearance.showPan && data.business.pan && <p style={{ fontSize: 9.5, color: headerMuted }}>PAN: {data.business.pan}</p>}
            {data.business.email && <p style={{ fontSize: 9.5, color: headerMuted }}>{data.business.email}</p>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: titleColor, letterSpacing: 1 }}>{appearance.invoiceTitle || "INVOICE"}</p>
          <p style={{ fontSize: 10, color: onDark ? "rgba(255,255,255,0.8)" : theme.muted }}>{data.invoiceNumber}</p>
          <span
            style={{
              display: "inline-block",
              marginTop: 6,
              padding: "2px 9px",
              borderRadius: 999,
              fontSize: 8.5,
              fontWeight: 700,
              color: onDark ? "#fff" : meta.color,
              background: onDark ? "rgba(255,255,255,0.18)" : `${meta.color}1f`,
              border: onDark ? "1px solid rgba(255,255,255,0.3)" : `1px solid ${meta.color}40`,
            }}
          >
            {meta.label}
          </span>
          {appearance.showDueStamp && data.balanceDue > 0 && (
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: onDark ? "#fff" : accent, border: `1px solid ${onDark ? "rgba(255,255,255,0.5)" : accent}`, borderRadius: 4, padding: "2px 6px", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Due {money(data.balanceDue)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: 24, position: "relative", zIndex: 1 }}>
        {/* Meta */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          {[
            { label: "Issue Date", value: formatDate(data.issueDate) },
            { label: "Due Date", value: formatDate(data.dueDate) },
            { label: "Amount Due", value: money(data.balanceDue), accent: true },
            { label: "Currency", value: curr },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                flex: 1,
                padding: 10,
                background: theme.panels ? theme.surfaceBg : "transparent",
                border: `1px solid ${theme.border}`,
                borderRadius: Math.min(radius, 8),
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 8, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{m.label}</p>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: m.accent ? accent : theme.text }}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Parties */}
        <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
          {[
            { label: "From", lines: [data.business.name, appearance.showGst && data.business.gstin ? `GSTIN: ${data.business.gstin}` : null, data.business.phone, data.business.website] },
            { label: "Bill To", lines: [data.customer.name, data.customer.company, data.customer.email, data.customer.address, appearance.showGst && data.customer.gstin ? `GSTIN: ${data.customer.gstin}` : null] },
          ].map((p) => (
            <div
              key={p.label}
              style={{
                flex: 1,
                padding: theme.panels ? 12 : 0,
                background: theme.panels ? theme.surfaceBg : "transparent",
                border: theme.panels ? `1px solid ${theme.border}` : "none",
                borderRadius: Math.min(radius, 8),
              }}
            >
              <p style={labelStyle}>{p.label}</p>
              {p.lines.filter(Boolean).map((line, i) => (
                <p key={i} style={{ fontSize: i === 0 ? 11.5 : 9.5, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? theme.text : theme.muted, marginBottom: 2 }}>
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>

        {/* Items */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: gridCols,
            background: tableHeadBg,
            color: tableHeadColor,
            padding: "7px 10px",
            borderRadius: theme.tableHeader === "soft" ? Math.min(radius, 6) : Math.min(radius, 6),
            border: theme.tableHeader === "soft" ? `1px solid ${theme.border}` : "none",
            fontSize: 8.5,
            fontWeight: 700,
            gap: 4,
          }}
        >
          {cols.map((c) => (
            <span key={c} style={{ textTransform: "uppercase", letterSpacing: 0.3, textAlign: numCols.has(c) ? "right" : "left" }}>{c}</span>
          ))}
        </div>
        {data.items.map((it, r) => (
          <div
            key={r}
            style={{
              display: "grid",
              gridTemplateColumns: gridCols,
              padding: "8px 10px",
              background: r % 2 ? theme.surfaceBg : "transparent",
              borderBottom: `1px solid ${theme.border}`,
              fontSize: 10,
              gap: 4,
              alignItems: "center",
            }}
          >
            <span style={{ color: theme.muted }}>{r + 1}</span>
            <span>
              <span style={{ color: theme.text }}>{it.description}</span>
              {appearance.showItemDescription && it.sku && <span style={{ color: theme.muted, fontSize: 8.5, marginLeft: 5 }}>{it.sku}</span>}
            </span>
            {showHsn && <span style={{ color: theme.muted }}>{it.hsnSac || "—"}</span>}
            <span style={{ textAlign: "right", color: theme.muted }}>{it.quantity}</span>
            <span style={{ textAlign: "right", color: theme.muted }}>{money(it.unitPrice)}</span>
            {appearance.showDiscountColumn && <span style={{ textAlign: "right", color: theme.muted }}>{it.discount ? money(it.discount) : "—"}</span>}
            {appearance.showTaxColumn && <span style={{ textAlign: "right", color: theme.muted }}>{it.taxPercent}%</span>}
            <span style={{ textAlign: "right", color: theme.text, fontWeight: 600 }}>{money(it.amount)}</span>
          </div>
        ))}

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <div style={{ width: 200 }}>
            <TotalLine label="Subtotal" value={money(data.subtotal)} theme={theme} />
            {data.discount > 0 && <TotalLine label="Discount" value={`- ${money(data.discount)}`} theme={theme} />}
            {appearance.showShipping && data.shipping > 0 && <TotalLine label="Shipping" value={money(data.shipping)} theme={theme} />}
            {!!data.adjustment && <TotalLine label="Adjustment" value={`${data.adjustment < 0 ? "- " : "+ "}${money(Math.abs(data.adjustment))}`} theme={theme} />}
            {appearance.showTaxColumn && <TotalLine label={`Tax (${data.taxRate}%)`} value={money(data.taxAmount)} theme={theme} />}
            {data.tdsTcsType && !!data.tdsTcsAmount && (
              <TotalLine
                label={data.tdsTcsLabel || data.tdsTcsType}
                value={`${data.tdsTcsType === "TDS" ? "- " : "+ "}${money(data.tdsTcsAmount)}`}
                theme={theme}
              />
            )}
            {!!data.roundOff && <TotalLine label="Round Off" value={`${data.roundOff < 0 ? "- " : "+ "}${money(Math.abs(data.roundOff))}`} theme={theme} />}
            <GrandTotal accent={accent} theme={theme} radius={radius} value={money(data.total)} />
            {data.paidAmount > 0 && <TotalLine label="Paid" value={money(data.paidAmount)} theme={theme} color="#16a34a" />}
            {data.balanceDue > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  marginTop: 4,
                  borderRadius: Math.min(radius, 6),
                  border: `1px solid ${accent}`,
                  fontWeight: 700,
                }}
              >
                <span style={{ fontSize: 10, color: accent }}>Balance Due</span>
                <span style={{ fontSize: 10.5, color: accent }}>{money(data.balanceDue)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Custom fields */}
        {customFields.length > 0 && (
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
            {customFields.map((f, i) => (
              <p key={i} style={{ fontSize: 9.5, color: theme.muted }}>
                <span style={{ fontWeight: 700, color: theme.text }}>{f.label}: </span>
                {f.value}
              </p>
            ))}
          </div>
        )}

        {/* Notes / Terms */}
        {appearance.showNotes && data.notes && (
          <div style={{ marginTop: 16, padding: 11, background: theme.surfaceBg, border: `1px solid ${theme.border}`, borderRadius: Math.min(radius, 8) }}>
            <p style={{ ...labelStyle, color: theme.muted }}>Notes</p>
            <p style={{ fontSize: 9.5, color: theme.text, lineHeight: 1.5 }}>{data.notes}</p>
          </div>
        )}
        {appearance.showTerms && data.terms && (
          <div style={{ marginTop: 10 }}>
            <p style={{ ...labelStyle, color: theme.muted }}>Terms &amp; Conditions</p>
            <p style={{ fontSize: 9, color: theme.muted, lineHeight: 1.5 }}>{data.terms}</p>
          </div>
        )}

        {/* Signature */}
        {appearance.signatureText && (
          <div style={{ marginTop: 20, textAlign: "right" }}>
            <div style={{ display: "inline-block", borderTop: `1px solid ${theme.muted}`, paddingTop: 4, minWidth: 130 }}>
              <p style={{ fontSize: 10, color: theme.text }}>{appearance.signatureText}</p>
              <p style={{ fontSize: 8, color: theme.muted }}>Authorized Signatory</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 18, borderTop: `1px solid ${theme.border}`, paddingTop: 9, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 8.5, color: theme.muted }}>{appearance.footerText}</span>
          {appearance.showQr &&
            (qrSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrSrc} alt="Scan to view invoice" style={{ width: 44, height: 44, borderRadius: 4 }} />
            ) : (
              <div style={{ width: 30, height: 30, background: "repeating-linear-gradient(45deg,#111,#111 2px,#fff 2px,#fff 4px)", borderRadius: 4 }} />
            ))}
        </div>
      </div>
    </div>
  );
}

function TotalLine({ label, value, theme, color }: { label: string; value: string; theme: ReturnType<typeof getTheme>; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderBottom: `1px solid ${theme.border}`, fontSize: 9.5 }}>
      <span style={{ color: theme.muted }}>{label}</span>
      <span style={{ fontWeight: 600, color: color ?? theme.text }}>{value}</span>
    </div>
  );
}

function GrandTotal({ accent, theme, radius, value }: { accent: string; theme: ReturnType<typeof getTheme>; radius: number; value: string }) {
  if (theme.totals === "outline") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", marginTop: 4, border: `2px solid ${accent}`, borderRadius: Math.min(radius, 6) }}>
        <span style={{ fontWeight: 700, color: theme.text }}>Total</span>
        <span style={{ fontWeight: 800, color: accent, fontSize: 12 }}>{value}</span>
      </div>
    );
  }
  if (theme.totals === "band") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", marginTop: 4, background: theme.darkBand, color: "#fff", borderRadius: Math.min(radius, 6) }}>
        <span style={{ fontWeight: 700 }}>Total</span>
        <span style={{ fontWeight: 800, fontSize: 12 }}>{value}</span>
      </div>
    );
  }
  // filled
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", marginTop: 4, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: "#fff", borderRadius: Math.min(radius, 6) }}>
      <span style={{ fontWeight: 700 }}>Total</span>
      <span style={{ fontWeight: 800, fontSize: 12 }}>{value}</span>
    </div>
  );
}
