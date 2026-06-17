// ============================================================
// lib/pdf/download-client.ts
// Browser-side helpers for downloading / printing a PDF that an API
// route streams back. They fetch the endpoint, surface JSON errors
// meaningfully, and drive the blob through the browser — no server
// state, no temp files.
// ============================================================

async function extractError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    /* not JSON */
  }
  return `PDF request failed (${res.status})`;
}

function filenameFromResponse(res: Response, fallback: string): string {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  return match ? decodeURIComponent(match[1]) : fallback;
}

/**
 * Fetch the PDF at `url` and trigger an immediate browser download.
 * Throws an Error (with a meaningful message) on failure.
 */
export async function downloadPdf(url: string, fallbackName: string): Promise<void> {
  const res = await fetch(url, { headers: { Accept: "application/pdf" } });
  if (!res.ok) throw new Error(await extractError(res));

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filenameFromResponse(res, fallbackName);
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Fetch the PDF at `url` (asking for inline disposition), load it into a
 * hidden iframe, and auto-trigger the print dialog. Using a blob: URL keeps
 * it same-origin and sidesteps X-Frame-Options on the API route.
 * Throws an Error on failure.
 */
export async function printPdf(url: string): Promise<void> {
  const inlineUrl = url + (url.includes("?") ? "&" : "?") + "disposition=inline";
  const res = await fetch(inlineUrl, { headers: { Accept: "application/pdf" } });
  if (!res.ok) throw new Error(await extractError(res));

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");

  const cleanup = () => {
    URL.revokeObjectURL(blobUrl);
    iframe.remove();
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      // Fallback: open the PDF in a new tab so the user can print manually.
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(cleanup, 1000);
      return;
    }
    win.addEventListener("afterprint", cleanup);
    try {
      win.focus();
      win.print();
    } catch {
      window.open(blobUrl, "_blank", "noopener,noreferrer");
    }
    // Safety net in case afterprint never fires (some browsers).
    setTimeout(cleanup, 60_000);
  };

  iframe.src = blobUrl;
  document.body.appendChild(iframe);
}
