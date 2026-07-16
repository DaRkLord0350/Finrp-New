// ============================================================
// lib/fraud/client-fingerprint.ts
//
// Real, working browser-side device fingerprint — the same class of
// technique open-source fingerprinting libraries (e.g. FingerprintJS's
// MIT-licensed core) are built on: canvas rendering differences
// (fonts/GPU/anti-aliasing) plus stable navigator/screen properties,
// hashed into a single stable string. No paid vendor SDK required for
// this baseline signal; a commercial provider can be layered in later
// as an additional, higher-confidence signal without changing the
// shape of what's stored (deviceFingerprint is just a string).
//
// Client-only — import from a "use client" component and POST the
// result alongside the loan application submission.
// ============================================================

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Non-cryptographic fallback (older browsers without SubtleCrypto in
  // an insecure context) — still deterministic, which is all a
  // fingerprint needs to be.
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function canvasSignature(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("FinRP fraud-check 🔒 v1", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("FinRP fraud-check 🔒 v1", 4, 17);
    return canvas.toDataURL();
  } catch {
    return "canvas-blocked";
  }
}

export interface DeviceFingerprintResult {
  fingerprint: string;
  components: Record<string, string | number>;
}

export async function generateDeviceFingerprint(): Promise<DeviceFingerprintResult> {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const scr = typeof screen !== "undefined" ? screen : undefined;

  const components: Record<string, string | number> = {
    userAgent: nav?.userAgent ?? "",
    language: nav?.language ?? "",
    languages: (nav?.languages ?? []).join(","),
    platform: nav?.platform ?? "",
    hardwareConcurrency: nav?.hardwareConcurrency ?? 0,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenWidth: scr?.width ?? 0,
    screenHeight: scr?.height ?? 0,
    colorDepth: scr?.colorDepth ?? 0,
    canvas: canvasSignature(),
  };

  const raw = Object.entries(components).map(([k, v]) => `${k}:${v}`).join("|");
  const fingerprint = await sha256Hex(raw);
  return { fingerprint, components };
}
