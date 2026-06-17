// ============================================================
// lib/invoices/appearance-defaults.ts
// Pure config (no DB imports) — safe to import from client components
// and the server appearance helper alike.
// ============================================================

export interface InvoiceAppearance {
  template: string;
  accentColor: string;
  fontFamily: string;
  borderRadius: number;
  invoiceTitle: string;
  footerText: string;
  signatureText: string | null;
  signatureImageUrl: string | null;
  watermarkText: string | null;
  draftWatermark: boolean;
  logoUrl: string | null;
  showLogo: boolean;
  showQr: boolean;
  showPaymentLink: boolean;
  showDueStamp: boolean;
  showGst: boolean;
  showPan: boolean;
  showItemDescription: boolean;
  showDiscountColumn: boolean;
  showTaxColumn: boolean;
  showShipping: boolean;
  showNotes: boolean;
  showTerms: boolean;
}

// Used when no settings row exists yet, so the PDF + preview always have
// a complete, valid configuration to render against.
export const DEFAULT_APPEARANCE: InvoiceAppearance = {
  template: "elegant-purple",
  accentColor: "#6366f1",
  fontFamily: "Helvetica",
  borderRadius: 8,
  invoiceTitle: "INVOICE",
  footerText: "Generated securely by FinRP",
  signatureText: null,
  signatureImageUrl: null,
  watermarkText: null,
  draftWatermark: true,
  logoUrl: null,
  showLogo: true,
  showQr: false,
  showPaymentLink: false,
  showDueStamp: true,
  showGst: true,
  showPan: true,
  showItemDescription: true,
  showDiscountColumn: true,
  showTaxColumn: true,
  showShipping: true,
  showNotes: true,
  showTerms: true,
};

// Built-in theme keys (the 6 distinct layouts land in Phase 2; this list
// keeps the settings UI and validation aligned today). `accent` powers the
// live preview swatch.
export const INVOICE_THEMES = [
  { key: "elegant-purple", label: "Elegant Purple", accent: "#6366f1" },
  { key: "modern-minimal", label: "Modern Minimal", accent: "#111827" },
  { key: "executive-dark", label: "Executive Dark", accent: "#0f172a" },
  { key: "glass-premium", label: "Glass Premium", accent: "#7c3aed" },
  { key: "corporate-blue", label: "Corporate Blue", accent: "#2563eb" },
  { key: "classic-accounting", label: "Classic Accounting", accent: "#047857" },
] as const;

// react-pdf ships these standard families; the select is constrained to them
// so the PDF never falls back to a missing font.
export const PDF_FONTS = ["Helvetica", "Times-Roman", "Courier"] as const;
