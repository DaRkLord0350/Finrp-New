// ============================================================
// lib/invoices/appearance.ts
// Invoice appearance / branding settings — single source of truth
// for the PDF renderer, the on-screen preview, and the settings UI.
// ============================================================

import { prisma } from "@/lib/prisma";
import { DEFAULT_APPEARANCE, type InvoiceAppearance } from "@/lib/invoices/appearance-defaults";

export { DEFAULT_APPEARANCE, INVOICE_THEMES, PDF_FONTS } from "@/lib/invoices/appearance-defaults";
export type { InvoiceAppearance } from "@/lib/invoices/appearance-defaults";

/**
 * Load the organization's invoice appearance, falling back to defaults.
 * Always returns a complete, render-ready object.
 */
export async function getInvoiceAppearance(organizationId: string): Promise<InvoiceAppearance> {
  const row = await prisma.invoiceAppearanceSettings.findUnique({
    where: { organizationId },
  });
  if (!row) return { ...DEFAULT_APPEARANCE };

  return {
    template: row.template,
    accentColor: row.accentColor,
    fontFamily: row.fontFamily,
    borderRadius: row.borderRadius,
    invoiceTitle: row.invoiceTitle,
    footerText: row.footerText,
    signatureText: row.signatureText,
    signatureImageUrl: row.signatureImageUrl,
    watermarkText: row.watermarkText,
    draftWatermark: row.draftWatermark,
    logoUrl: row.logoUrl,
    showLogo: row.showLogo,
    showQr: row.showQr,
    showPaymentLink: row.showPaymentLink,
    showDueStamp: row.showDueStamp,
    showGst: row.showGst,
    showPan: row.showPan,
    showItemDescription: row.showItemDescription,
    showDiscountColumn: row.showDiscountColumn,
    showTaxColumn: row.showTaxColumn,
    showShipping: row.showShipping,
    showNotes: row.showNotes,
    showTerms: row.showTerms,
  };
}
