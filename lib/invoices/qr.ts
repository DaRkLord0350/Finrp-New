// ============================================================
// lib/invoices/qr.ts
// Server-only QR helper. Produces a PNG data URL usable by both
// @react-pdf/renderer <Image> and an HTML <img>.
// ============================================================

import QRCode from "qrcode";

export async function qrDataUrl(
  text: string,
  opts?: { size?: number; margin?: number; color?: string }
): Promise<string | null> {
  if (!text) return null;
  try {
    return await QRCode.toDataURL(text, {
      width: opts?.size ?? 160,
      margin: opts?.margin ?? 1,
      errorCorrectionLevel: "M",
      color: { dark: opts?.color ?? "#111827", light: "#ffffffff" },
    });
  } catch {
    return null;
  }
}

/**
 * Build a UPI payment deep-link string (upi://pay?...) for QR encoding.
 * Returns null when no payee VPA is configured.
 */
export function buildUpiUri(params: {
  vpa?: string | null;
  payeeName: string;
  amount?: number;
  note?: string;
}): string | null {
  if (!params.vpa) return null;
  const q = new URLSearchParams({
    pa: params.vpa,
    pn: params.payeeName,
    cu: "INR",
  });
  if (params.amount && params.amount > 0) q.set("am", params.amount.toFixed(2));
  if (params.note) q.set("tn", params.note);
  return `upi://pay?${q.toString()}`;
}
