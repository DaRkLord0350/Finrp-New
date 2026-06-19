"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Upload, RotateCcw, Ban, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";
import { useJournal, useJournalMutations, type JournalStatus } from "@/hooks/useJournals";

const STATUS_COLORS: Record<JournalStatus, string> = { DRAFT: "#f59e0b", POSTED: "#10b981", VOID: "#ef4444" };

export default function JournalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const { journal, loading } = useJournal(id);
  const { post, reverse, void: voidJournal, remove } = useJournalMutations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;
  if (!journal) return <p style={{ color: "var(--text-muted)" }}>Journal not found.</p>;

  const totalDebit = Number(journal.totalDebit);
  const totalCredit = Number(journal.totalCredit);

  return (
    <div>
      <Link href="/accounting/journals" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13, marginBottom: 16, textDecoration: "none" }}>
        <ArrowLeft size={14} /> Back to Journals
      </Link>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{error}</div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              {journal.journalNumber ?? "Draft Journal"}
            </h1>
            <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLORS[journal.status], background: `${STATUS_COLORS[journal.status]}1a`, padding: "3px 10px", borderRadius: 6 }}>{journal.status}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{journal.journalType}</span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
            {new Date(journal.entryDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            {journal.reference ? ` · Ref: ${journal.reference}` : ""}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {journal.status === "DRAFT" && (
            <>
              <Link href={`/accounting/journals/${id}/edit`} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px" }}><Pencil size={14} /> Edit</Link>
              <button onClick={() => run(() => post(id))} disabled={busy} className="btn-brand" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px" }}><Upload size={14} /> Post</button>
              <button onClick={() => run(() => remove(id).then(() => router.push("/accounting/journals")), "Delete this draft journal?")} disabled={busy} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", color: "#ef4444" }}><Trash2 size={14} /> Delete</button>
            </>
          )}
          {journal.status === "POSTED" && (
            <>
              <button onClick={() => run(() => reverse(id).then((r) => r && "id" in r ? router.push(`/accounting/journals/${(r as { id: string }).id}`) : null))} disabled={busy} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px" }}><RotateCcw size={14} /> Reverse</button>
              {journal.journalType !== "SYSTEM" && (
                <button onClick={() => run(() => voidJournal(id), "Void this posted journal? Its ledger effect will be removed.")} disabled={busy} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", color: "#ef4444" }}><Ban size={14} /> Void</button>
              )}
            </>
          )}
        </div>
      </div>

      {(journal.reversalOf || journal.reversals.length > 0) && (
        <div className="surface" style={{ padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "var(--text-secondary)" }}>
          {journal.reversalOf && (
            <>Reverses <Link href={`/accounting/journals/${journal.reversalOf.id}`} style={{ color: "var(--brand-400)" }}>{journal.reversalOf.journalNumber ?? "entry"}</Link>. </>
          )}
          {journal.reversals.map((r) => (
            <span key={r.id}>Reversed by <Link href={`/accounting/journals/${r.id}`} style={{ color: "var(--brand-400)" }}>{r.journalNumber ?? "entry"}</Link>. </span>
          ))}
        </div>
      )}

      {journal.description && (
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>{journal.description}</p>
      )}

      <div className="surface" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={th}>Account</th>
              <th style={th}>Description</th>
              <th style={{ ...th, textAlign: "right" }}>Debit</th>
              <th style={{ ...th, textAlign: "right" }}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {journal.lines.map((l) => (
              <tr key={l.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}>
                  <Link href={`/accounting/chart-of-accounts`} style={{ color: "var(--text-primary)", fontWeight: 600 }}>{l.account.code}</Link>
                  <span style={{ color: "var(--text-muted)" }}> — {l.account.name}</span>
                </td>
                <td style={{ ...td, color: "var(--text-muted)" }}>{l.description ?? "—"}</td>
                <td style={{ ...td, textAlign: "right" }}>{l.type === "DEBIT" ? formatCurrency(Number(l.amount)) : ""}</td>
                <td style={{ ...td, textAlign: "right" }}>{l.type === "CREDIT" ? formatCurrency(Number(l.amount)) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "1px solid var(--border-strong)", background: "var(--bg-elevated)", fontWeight: 700 }}>
              <td style={td} colSpan={2}>Totals</td>
              <td style={{ ...td, textAlign: "right" }}>{formatCurrency(totalDebit)}</td>
              <td style={{ ...td, textAlign: "right" }}>{formatCurrency(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {journal.notes && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Notes</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{journal.notes}</p>
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 20 }}>
        Created by {journal.createdByUser?.name ?? journal.createdByUser?.email ?? "—"}
        {journal.postedAt ? ` · Posted ${new Date(journal.postedAt).toLocaleString("en-IN")}` : ""}
      </p>
    </div>
  );
}

const th: React.CSSProperties = { padding: "12px 20px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "12px 20px", color: "var(--text-secondary)" };
