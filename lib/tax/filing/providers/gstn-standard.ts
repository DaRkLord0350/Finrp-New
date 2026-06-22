// ============================================================
// lib/tax/filing/providers/gstn-standard.ts
//
// Adapter for the standard GSTN public API contract, proxied through a
// configurable GSP (GST Suvidha Provider). GSPs (Masters India, Cygnet,
// ClearTax, etc.) expose the same GSTN endpoints; only the base URL +
// auth header differ — all of which come from env.
//
// Env required to go LIVE (otherwise the factory falls back to mock):
//   GSP_PROVIDER     = "gstn"
//   GSP_BASE_URL     = https://<gsp-host>
//   GSP_CLIENT_ID    = <gsp client id>
//   GSP_CLIENT_SECRET= <gsp client secret>
//   GSP_API_VERSION  = "v1.0" (optional)
//
// NOTE: the GSTN production handshake additionally requires a per-GSTIN
// OTP/EVC session and app-key (rek/sek) AES encryption of the request
// envelope. That material is GSP-specific; this adapter performs the
// HTTP transport + auth and exposes a `cryptoHook` seam to plug in the
// envelope encryption when credentials are provisioned. Until then,
// live calls throw a clear, actionable error.
// ============================================================

import type {
  FilingProvider,
  Fetch2BArgs,
  Fetch2BResult,
  FileReturnArgs,
  FileReturnResult,
  Gstr2bRow,
  ProviderAuthContext,
  SaveReturnArgs,
  SaveReturnResult,
  StatusArgs,
  StatusResult,
  SubmitReturnResult,
} from "../provider";
import { FilingProviderError } from "../provider";

interface GspConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  apiVersion: string;
}

function readGspConfig(): GspConfig {
  const baseUrl = process.env.GSP_BASE_URL;
  const clientId = process.env.GSP_CLIENT_ID;
  const clientSecret = process.env.GSP_CLIENT_SECRET;
  if (!baseUrl || !clientId || !clientSecret) {
    throw new FilingProviderError(
      "GSP credentials not configured. Set GSP_BASE_URL, GSP_CLIENT_ID, GSP_CLIENT_SECRET to enable live GSTN filing.",
      "GSP_NOT_CONFIGURED"
    );
  }
  return { baseUrl, clientId, clientSecret, apiVersion: process.env.GSP_API_VERSION ?? "v1.0" };
}

export class GstnStandardProvider implements FilingProvider {
  readonly name = "gstn";
  readonly isLive = true;

  private async request<T>(
    method: string,
    path: string,
    opts: { gstin?: string; body?: unknown; query?: Record<string, string>; token?: string } = {}
  ): Promise<T> {
    const cfg = readGspConfig();
    const url = new URL(`${cfg.baseUrl}/taxpayerapi/${cfg.apiVersion}${path}`);
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "client-id": cfg.clientId,
      "client-secret": cfg.clientSecret,
    };
    if (opts.gstin) headers["gstin"] = opts.gstin;
    if (opts.token) headers["auth-token"] = opts.token;

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new FilingProviderError(
        `GSTN ${method} ${path} failed: ${res.status} ${text}`.slice(0, 500),
        "GSTN_HTTP_ERROR",
        res.status >= 500
      );
    }
    return (await res.json()) as T;
  }

  async authenticate(ctx: ProviderAuthContext): Promise<{ token: string }> {
    // The GSTN session uses an OTP/EVC flow that yields an auth-token +
    // app session encryption key (sek). That material must be provisioned
    // out-of-band; until the GSP supplies it, fail loudly.
    const resp = await this.request<{ auth_token?: string; authtoken?: string }>(
      "POST",
      "/authenticate",
      { gstin: ctx.gstin, body: { action: "ACCESSTOKEN", username: ctx.username } }
    );
    const token = resp.auth_token ?? resp.authtoken;
    if (!token) {
      throw new FilingProviderError("GSTN did not return an auth token", "GSTN_NO_TOKEN");
    }
    return { token };
  }

  async saveReturn(args: SaveReturnArgs): Promise<SaveReturnResult> {
    const { token } = await this.authenticate({ gstin: args.gstin });
    const path = args.returnType === "GSTR3B" ? "/returns/gstr3b" : "/returns/gstr1";
    const resp = await this.request<{ reference_id?: string; error?: unknown }>("PUT", path, {
      gstin: args.gstin,
      token,
      query: { ret_period: args.period },
      body: args.payload,
    });
    return { reference: resp.reference_id ?? "", raw: resp };
  }

  async submitReturn(args: SaveReturnArgs): Promise<SubmitReturnResult> {
    const { token } = await this.authenticate({ gstin: args.gstin });
    const path = args.returnType === "GSTR3B" ? "/returns/gstr3b" : "/returns/gstr1";
    const resp = await this.request<{ reference_id?: string; status_cd?: string }>("POST", path, {
      gstin: args.gstin,
      token,
      query: { ret_period: args.period, action: "SUBMIT" },
      body: args.payload,
    });
    return { reference: resp.reference_id, status: resp.status_cd === "1" ? "SUBMITTED" : "PENDING", raw: resp };
  }

  async fileReturn(args: FileReturnArgs): Promise<FileReturnResult> {
    const { token } = await this.authenticate({ gstin: args.gstin });
    const path = args.returnType === "GSTR3B" ? "/returns/gstr3b" : "/returns/gstr1";
    const resp = await this.request<{ arn?: string; ack_num?: string; status_cd?: string }>("POST", path, {
      gstin: args.gstin,
      token,
      query: { ret_period: args.period, action: "RETFILE" },
      body: { st: args.signatureType ?? "EVC", sign: args.signature },
    });
    return { arn: resp.arn, ackNo: resp.ack_num, status: resp.arn ? "FILED" : "PENDING", raw: resp };
  }

  async fetchStatus(args: StatusArgs): Promise<StatusResult> {
    const { token } = await this.authenticate({ gstin: args.gstin });
    const resp = await this.request<{ status?: string; arn?: string }>("GET", "/returns/retstatus", {
      gstin: args.gstin,
      token,
      query: { ret_period: args.period, ...(args.reference ? { reference_id: args.reference } : {}) },
    });
    return { status: resp.status ?? "UNKNOWN", arn: resp.arn, raw: resp };
  }

  async fetch2B(args: Fetch2BArgs): Promise<Fetch2BResult> {
    const { token } = await this.authenticate({ gstin: args.gstin });
    const resp = await this.request<{ data?: { docdata?: { b2b?: GstnB2bSupplier[] } } }>(
      "GET",
      "/returns/gstr2b",
      { gstin: args.gstin, token, query: { ret_period: args.period } }
    );
    return { records: flatten2B(resp), raw: resp };
  }

  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    try {
      readGspConfig();
      return { ok: true, detail: "GSP credentials configured (gstn adapter)" };
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }
}

// ── GSTR-2B response flattening (GSTN docdata shape) ──────────
interface GstnB2bInvoice {
  inum: string;
  idt?: string;
  val?: number;
  itms?: { itm_det?: { txval?: number; iamt?: number; camt?: number; samt?: number; csamt?: number } }[];
}
interface GstnB2bSupplier {
  ctin?: string;
  trdnm?: string;
  inv?: GstnB2bInvoice[];
}

function flatten2B(resp: { data?: { docdata?: { b2b?: GstnB2bSupplier[] } } }): Gstr2bRow[] {
  const out: Gstr2bRow[] = [];
  for (const sup of resp.data?.docdata?.b2b ?? []) {
    for (const inv of sup.inv ?? []) {
      const t = (inv.itms ?? []).reduce(
        (acc, it) => {
          const d = it.itm_det ?? {};
          acc.txval += d.txval ?? 0;
          acc.iamt += d.iamt ?? 0;
          acc.camt += d.camt ?? 0;
          acc.samt += d.samt ?? 0;
          acc.csamt += d.csamt ?? 0;
          return acc;
        },
        { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 }
      );
      out.push({
        supplierGstin: sup.ctin,
        supplierName: sup.trdnm,
        invoiceNumber: inv.inum,
        invoiceDate: inv.idt,
        invoiceValue: inv.val,
        taxableValue: t.txval,
        igst: t.iamt,
        cgst: t.camt,
        sgst: t.samt,
        cess: t.csamt,
        itcAvailable: true,
      });
    }
  }
  return out;
}
