"use client";

import { useEffect, useState } from "react";
import { FileText, Upload, Plus } from "lucide-react";
import { PageHeader, Section, Btn, PeriodSelect, StatusBadge, apiGet, apiPost, formatINR } from "../../../_components/ui";

interface Invoice {
  id: string;
  classification: string;
  direction: string;
  counterpartyGstin?: string | null;
  counterpartyName?: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  taxableValue: string;
  igst: string; cgst: string; sgst: string;
}

export default function InvoicesPage() {
  const [period, setPeriod] = useState("052025");
  const [direction, setDirection] = useState<"OUTWARD" | "INWARD">("OUTWARD");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [csv, setCsv] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const r = await apiGet<{ invoices: Invoice[] }>(`/api/tax/gst/invoices?period=${period}&direction=${direction}`);
    setInvoices(r.invoices);
  };
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [period, direction]);

  const doImport = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await apiPost<{ committed: number; invalid: number }>("/api/tax/gst/import", { format: "csv", direction, content: csv });
      setMsg(`Imported ${r.committed} invoices (${r.invalid} invalid).`);
      setCsv(""); setShowImport(false);
      await load();
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  };

  const sampleCsv = "invoice_number,invoice_date,gstin,taxable_value,igst,cgst,sgst,place_of_supply,hsn\nINV-900,15-05-2025,24AAACI1681G1Z* ,100000,18000,0,0,24,8471";

  return (
    <div>
      <PageHeader
        title="GST Invoices"
        subtitle="Import, classify & review outward / inward supplies"
        icon={<FileText size={20} />}
        actions={
          <>
            <PeriodSelect value={period} onChange={setPeriod} />
            <Btn variant="ghost" onClick={() => setShowImport((v) => !v)}><Upload size={14} />Import CSV</Btn>
          </>
        }
      />

      <div className="mb-4 flex gap-2">
        {(["OUTWARD", "INWARD"] as const).map((d) => (
          <button key={d} onClick={() => setDirection(d)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${direction === d ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
            {d === "OUTWARD" ? "Sales (Outward)" : "Purchases (Inward)"}
          </button>
        ))}
      </div>

      {msg && <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-2 text-sm">{msg}</div>}

      {showImport && (
        <Section title="Import invoices from CSV">
          <p className="mb-2 text-xs text-muted-foreground">Headers are matched flexibly (invoice_number, invoice_date, gstin, taxable_value, igst, cgst, sgst, place_of_supply, hsn…). Raw rows are preserved for audit.</p>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={sampleCsv} rows={5} className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs" />
          <div className="mt-2 flex gap-2">
            <Btn onClick={doImport} disabled={busy || !csv.trim()}><Plus size={14} />{busy ? "Importing…" : "Import"}</Btn>
          </div>
        </Section>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Invoice #</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Counterparty</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2 text-right">Taxable</th>
              <th className="px-3 py-2 text-right">Tax</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No invoices for this period. Import a CSV or load demo data from the overview.</td></tr>
            ) : invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{inv.invoiceNumber}</td>
                <td className="px-3 py-2 text-muted-foreground">{new Date(inv.invoiceDate).toLocaleDateString("en-IN")}</td>
                <td className="px-3 py-2">{inv.counterpartyName ?? "—"}<br /><span className="text-[11px] text-muted-foreground">{inv.counterpartyGstin ?? ""}</span></td>
                <td className="px-3 py-2"><StatusBadge status={inv.classification} /></td>
                <td className="px-3 py-2 text-right">{formatINR(inv.taxableValue)}</td>
                <td className="px-3 py-2 text-right">{formatINR(Number(inv.igst) + Number(inv.cgst) + Number(inv.sgst))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
