"use client";

import { useState } from "react";
import { useQuery } from "@/lib/queryCache";
import {
  Sparkles,
  Copy,
  Save,
  FileBarChart,
  CheckCheck,
} from "lucide-react";

type Report = {
  id: string;
  statementType: string;
  periodStart: string;
  periodEnd: string;
};

type AIReviewResult = {
  review: string;
  generatedAt: string;
  model?: string;
};

function DotsLoader() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: "50%", background: "#818cf8",
            display: "inline-block",
            animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

export default function AIReviewPage() {
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [result, setResult] = useState<AIReviewResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: reports, isLoading: reportsLoading } = useQuery<Report[]>(
    ["fs-reports-list"],
    async () => {
      const r = await fetch("/api/financial-statements/reports");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }
  );

  async function generateReview() {
    if (!selectedReportId) return;
    setGenerating(true);
    setGenError(null);
    setResult(null);
    try {
      const r = await fetch("/api/financial-statements/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: selectedReportId }),
      });
      if (!r.ok) throw new Error("AI review request failed");
      const data: AIReviewResult = await r.json();
      setResult(data);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }

  async function copyReview() {
    if (!result) return;
    await navigator.clipboard.writeText(result.review);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveToReport() {
    if (!result || !selectedReportId) return;
    setSaving(true);
    try {
      await fetch(`/api/financial-statements/reports/${selectedReportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: result.review }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={18} style={{ color: "#fff" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              AI Financial Review
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              Gemini-powered analysis of your financial statements.
            </p>
          </div>
        </div>
        <button
          onClick={generateReview}
          disabled={!selectedReportId || generating}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 18px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff", border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 600,
            cursor: !selectedReportId || generating ? "not-allowed" : "pointer",
            opacity: !selectedReportId || generating ? 0.6 : 1,
            boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
          }}
        >
          <Sparkles size={14} />
          {generating ? "Analysing…" : "Generate AI Review"}
        </button>
      </div>

      {/* Report selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
          Report
        </label>
        {reportsLoading ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading reports…</div>
        ) : (
          <select
            value={selectedReportId}
            onChange={(e) => { setSelectedReportId(e.target.value); setResult(null); }}
            style={{
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "8px 12px", fontSize: 13,
              color: "var(--text-primary)", minWidth: 360,
            }}
          >
            <option value="">— Select a report —</option>
            {(reports ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.statementType} · {r.periodStart?.slice(0, 10)} → {r.periodEnd?.slice(0, 10)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Empty state */}
      {!selectedReportId && !generating && (
        <div className="surface" style={{ padding: 48, textAlign: "center", borderRadius: 12 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
            background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={24} style={{ color: "#818cf8" }} />
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 320, margin: "0 auto" }}>
            Select a report and click "Generate AI Review" to get a comprehensive analysis.
          </p>
        </div>
      )}

      {/* Loading state */}
      {generating && (
        <div className="surface" style={{ padding: 48, textAlign: "center", borderRadius: 12 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 20px",
            background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={24} style={{ color: "#818cf8" }} />
          </div>
          <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            AI is analysing your financial statements
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <DotsLoader />
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 12 }}>
            This may take a few seconds…
          </p>
        </div>
      )}

      {/* Error */}
      {genError && !generating && (
        <div style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8, padding: "12px 16px", marginBottom: 16,
          fontSize: 13, color: "var(--text-primary)",
        }}>
          {genError}
        </div>
      )}

      {/* Review output */}
      {result && !generating && (
        <div className="surface" style={{ borderRadius: 12, overflow: "hidden" }}>
          {/* Toolbar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 18px", borderBottom: "1px solid var(--border)",
            background: "var(--bg-elevated)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={14} style={{ color: "#818cf8" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>AI Review</span>
              {result.generatedAt && (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Generated {new Date(result.generatedAt).toLocaleString()}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={copyReview}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 6, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                {copied ? <CheckCheck size={12} style={{ color: "#34d399" }} /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={saveToReport}
                disabled={saving}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                  background: saving || saved ? "rgba(16,185,129,0.15)" : "#6366f1",
                  border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  color: saving || saved ? "#34d399" : "#fff",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                <Save size={12} />
                {saving ? "Saving…" : saved ? "Saved!" : "Save to Report"}
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: 24 }}>
            <div
              style={{
                fontSize: 14, lineHeight: 1.8, color: "var(--text-primary)",
                whiteSpace: "pre-wrap", fontFamily: "inherit",
              }}
            >
              {result.review}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: "10px 18px", borderTop: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Sparkles size={11} style={{ color: "#818cf8" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Powered by Gemini AI · Results are informational and should be reviewed by a qualified professional
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
