// ============================================================
// lib/invoices/themes.ts
// Pure, client-safe theme definitions shared by the on-screen
// HTML preview (components/billing/InvoicePreview) and the PDF
// renderer (components/pdf/InvoicePDF). No DB imports.
// ============================================================

export type HeaderStyle = "bar" | "filled" | "line" | "dark";
export type TableHeaderStyle = "accent" | "dark" | "soft";
export type TotalsStyle = "filled" | "band" | "outline";
export type PdfFont = "Helvetica" | "Times-Roman" | "Courier";

export interface InvoiceThemeDef {
  key: string;
  label: string;
  /** Default accent — also applied to appearance.accentColor when the theme is picked. */
  accent: string;
  font: PdfFont;
  pageBg: string;
  surfaceBg: string; // tinted panel fill
  text: string;
  muted: string;
  border: string;
  /** Dark band color for header==="dark" themes. */
  darkBand: string;
  header: HeaderStyle;
  tableHeader: TableHeaderStyle;
  totals: TotalsStyle;
  /** Whether From / Bill-To / meta use filled panels (vs. plain text). */
  panels: boolean;
  uppercaseLabels: boolean;
}

export const INVOICE_THEME_DEFS: Record<string, InvoiceThemeDef> = {
  "elegant-purple": {
    key: "elegant-purple",
    label: "Elegant Purple",
    accent: "#6366f1",
    font: "Helvetica",
    pageBg: "#ffffff",
    surfaceBg: "#f9fafb",
    text: "#111827",
    muted: "#6b7280",
    border: "#e5e7eb",
    darkBand: "#1e1b4b",
    header: "bar",
    tableHeader: "accent",
    totals: "filled",
    panels: true,
    uppercaseLabels: true,
  },
  "modern-minimal": {
    key: "modern-minimal",
    label: "Modern Minimal",
    accent: "#111827",
    font: "Helvetica",
    pageBg: "#ffffff",
    surfaceBg: "#ffffff",
    text: "#111827",
    muted: "#9ca3af",
    border: "#ececec",
    darkBand: "#111827",
    header: "line",
    tableHeader: "soft",
    totals: "outline",
    panels: false,
    uppercaseLabels: true,
  },
  "executive-dark": {
    key: "executive-dark",
    label: "Executive Dark",
    accent: "#b8860b",
    font: "Helvetica",
    pageBg: "#ffffff",
    surfaceBg: "#f4f4f5",
    text: "#18181b",
    muted: "#71717a",
    border: "#d4d4d8",
    darkBand: "#18181b",
    header: "dark",
    tableHeader: "dark",
    totals: "band",
    panels: true,
    uppercaseLabels: true,
  },
  "glass-premium": {
    key: "glass-premium",
    label: "Glass Premium",
    accent: "#7c3aed",
    font: "Helvetica",
    pageBg: "#faf5ff",
    surfaceBg: "#f5f3ff",
    text: "#1f2937",
    muted: "#7c7c8a",
    border: "#e9d5ff",
    darkBand: "#3b0764",
    header: "filled",
    tableHeader: "soft",
    totals: "filled",
    panels: true,
    uppercaseLabels: false,
  },
  "corporate-blue": {
    key: "corporate-blue",
    label: "Corporate Blue",
    accent: "#2563eb",
    font: "Helvetica",
    pageBg: "#ffffff",
    surfaceBg: "#f1f5f9",
    text: "#0f172a",
    muted: "#64748b",
    border: "#cbd5e1",
    darkBand: "#1e3a8a",
    header: "filled",
    tableHeader: "accent",
    totals: "band",
    panels: true,
    uppercaseLabels: true,
  },
  "classic-accounting": {
    key: "classic-accounting",
    label: "Classic Accounting",
    accent: "#047857",
    font: "Times-Roman",
    pageBg: "#ffffff",
    surfaceBg: "#ffffff",
    text: "#1f2937",
    muted: "#6b7280",
    border: "#9ca3af",
    darkBand: "#064e3b",
    header: "line",
    tableHeader: "soft",
    totals: "outline",
    panels: false,
    uppercaseLabels: false,
  },
};

export const DEFAULT_THEME_KEY = "elegant-purple";

export function getTheme(key: string | null | undefined): InvoiceThemeDef {
  return (key && INVOICE_THEME_DEFS[key]) || INVOICE_THEME_DEFS[DEFAULT_THEME_KEY];
}

export const INVOICE_THEME_LIST = Object.values(INVOICE_THEME_DEFS);
