"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Palette, RefreshCw, Save, FileText, BookmarkPlus, Trash2 } from "lucide-react";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import {
  DEFAULT_APPEARANCE,
  PDF_FONTS,
  type InvoiceAppearance,
} from "@/lib/invoices/appearance-defaults";
import { INVOICE_THEME_LIST } from "@/lib/invoices/themes";
import InvoicePreview, { SAMPLE_INVOICE } from "@/components/billing/InvoicePreview";

interface SavedTemplate {
  id: string;
  name: string;
  key: string;
  config: Partial<InvoiceAppearance>;
  createdAt: string;
}

// ── Small form primitives (kept local to this settings page) ──────────────
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "9px 12px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        cursor: "pointer",
        width: "100%",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
      <span
        style={{
          width: 36,
          height: 20,
          borderRadius: 999,
          background: checked ? "var(--brand)" : "var(--border-strong)",
          position: "relative",
          flexShrink: 0,
          transition: "background 0.15s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s ease",
          }}
        />
      </span>
    </button>
  );
}

export default function InvoiceAppearancePage() {
  const { isMobile, isTablet } = useBreakpoint();
  const [form, setForm] = useState<InvoiceAppearance>(DEFAULT_APPEARANCE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/invoice-appearance");
        if (!res.ok) throw new Error("Failed to load appearance");
        const data = await res.json();
        if (!cancelled && data.appearance) setForm(data.appearance as InvoiceAppearance);
      } catch {
        if (!cancelled) toast.error("Couldn't load appearance settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/invoices/templates");
      if (!res.ok) return;
      const data = await res.json();
      setTemplates((data.templates ?? []) as SavedTemplate[]);
    } catch {
      /* templates are non-critical */
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const set = <K extends keyof InvoiceAppearance>(key: K, value: InvoiceAppearance[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSaveTemplate = async () => {
    const name = window.prompt("Name this template");
    if (!name || !name.trim()) return;
    try {
      const res = await fetch("/api/invoices/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), key: form.template, config: form }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to save template");
      }
      toast.success("Template saved");
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save template");
    }
  };

  const applyTemplate = (t: SavedTemplate) => {
    setForm({ ...DEFAULT_APPEARANCE, ...(t.config ?? {}) });
    toast.success(`Applied "${t.name}" — remember to Save`);
  };

  const deleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete template");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete template");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/invoice-appearance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to save");
      }
      const data = await res.json();
      if (data.appearance) setForm(data.appearance as InvoiceAppearance);
      toast.success("Invoice appearance saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save appearance");
    } finally {
      setSaving(false);
    }
  };

  const toggles: Array<{ key: keyof InvoiceAppearance; label: string }> = [
    { key: "showLogo", label: "Show Logo" },
    { key: "showGst", label: "Show GSTIN" },
    { key: "showPan", label: "Show PAN" },
    { key: "showItemDescription", label: "Show Item Description" },
    { key: "showDiscountColumn", label: "Show Discount Column" },
    { key: "showTaxColumn", label: "Show Tax Column" },
    { key: "showShipping", label: "Show Shipping" },
    { key: "showNotes", label: "Show Notes" },
    { key: "showTerms", label: "Show Terms" },
    { key: "showDueStamp", label: "Show Due Stamp" },
    { key: "showQr", label: "Show QR (Phase 3)" },
    { key: "showPaymentLink", label: "Show Payment Link (Phase 3)" },
  ];

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 10, color: "var(--text-muted)" }}>
        <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
        Loading appearance…
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1280, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Palette size={18} color="#818cf8" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Invoice Appearance</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>Customize how your invoices and PDFs look. Changes preview live.</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-brand" style={{ cursor: saving ? "wait" : "pointer" }}>
          {saving ? <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={15} />}
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)", gap: 24, alignItems: "start" }}>
        {/* ── Form ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Theme + brand */}
          <motion.div className="surface" style={{ padding: 20 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Theme & Brand</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Template">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                  {INVOICE_THEME_LIST.map((t) => {
                    const active = form.template === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, template: t.key, accentColor: t.accent, fontFamily: t.font }))}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "9px 11px",
                          borderRadius: 8,
                          border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                          background: active ? "rgba(99,102,241,0.08)" : "var(--bg-elevated)",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ width: 14, height: 14, borderRadius: 4, background: t.accent, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: active ? "var(--text-primary)" : "var(--text-secondary)" }}>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Selecting a template sets its layout and accent — tweak the color below to make it yours.</p>
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Accent Color">
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={form.accentColor} onChange={(e) => set("accentColor", e.target.value)} style={{ width: 40, height: 38, padding: 0, border: "1px solid var(--border)", borderRadius: 8, background: "none", cursor: "pointer" }} />
                    <input className="input" value={form.accentColor} onChange={(e) => set("accentColor", e.target.value)} style={{ fontFamily: "monospace" }} />
                  </div>
                </Field>
                <Field label="Font Family">
                  <select className="input" value={form.fontFamily} onChange={(e) => set("fontFamily", e.target.value)}>
                    {PDF_FONTS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label={`Border Radius (${form.borderRadius}px)`}>
                  <input type="range" min={0} max={24} value={form.borderRadius} onChange={(e) => set("borderRadius", Number(e.target.value))} style={{ width: "100%" }} />
                </Field>
                <Field label="Invoice Title">
                  <input className="input" value={form.invoiceTitle} onChange={(e) => set("invoiceTitle", e.target.value)} maxLength={40} />
                </Field>
              </div>
            </div>
          </motion.div>

          {/* Text */}
          <motion.div className="surface" style={{ padding: 20 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Text & Signature</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Footer Text">
                <input className="input" value={form.footerText} onChange={(e) => set("footerText", e.target.value)} maxLength={300} />
              </Field>
              <Field label="Authorized Signature Label" hint="e.g. 'For FinRP Pvt. Ltd.' or a signatory name">
                <input className="input" value={form.signatureText ?? ""} onChange={(e) => set("signatureText", e.target.value || null)} maxLength={120} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
                <Field label="Watermark Text" hint="Optional overlay across the page">
                  <input className="input" value={form.watermarkText ?? ""} onChange={(e) => set("watermarkText", e.target.value || null)} maxLength={60} placeholder="e.g. CONFIDENTIAL" />
                </Field>
                <div style={{ minWidth: 160 }}>
                  <Toggle label="Draft Watermark" checked={form.draftWatermark} onChange={(v) => set("draftWatermark", v)} />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Toggles */}
          <motion.div className="surface" style={{ padding: 20 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Visibility</h2>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
              {toggles.map((t) => (
                <Toggle key={String(t.key)} label={t.label} checked={Boolean(form[t.key])} onChange={(v) => set(t.key, v as never)} />
              ))}
            </div>
          </motion.div>

          {/* Saved templates */}
          <motion.div className="surface" style={{ padding: 20 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Saved Templates</h2>
              <button onClick={handleSaveTemplate} className="btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }}>
                <BookmarkPlus size={13} /> Save current
              </button>
            </div>
            {templates.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No saved templates yet. Tune the look above and save it for reuse.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {templates.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: t.config?.accentColor ?? "var(--brand)", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                    <button onClick={() => applyTemplate(t)} className="btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }}>Apply</button>
                    <button onClick={() => deleteTemplate(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }} title="Delete template">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Live Preview ── */}
        <div style={{ position: isMobile || isTablet ? "static" : "sticky", top: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={12} /> Live Preview
          </p>
          <InvoicePreview appearance={form} data={SAMPLE_INVOICE} />
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
