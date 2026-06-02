"use client";

import { useState, useEffect } from "react";
import { Palette, Save, Eye, Upload } from "lucide-react";

interface Branding {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  footerText: string | null;
  [key: string]: string | null;
}

export default function BrandingPage() {
  const [branding, setBranding] = useState<Branding>({
    logoUrl: null, primaryColor: "#6366f1", secondaryColor: "#0ea5e9",
    supportEmail: null, supportPhone: null, footerText: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    fetch("/api/firm/branding")
      .then((r) => r.json())
      .then((d) => {
        if (d.branding) setBranding({ ...branding, ...d.branding });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/firm/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-container"><div className="section-card"><div className="empty-state"><div className="loading-spinner" /></div></div></div>;
  }

  const primary = branding.primaryColor ?? "#6366f1";
  const secondary = branding.secondaryColor ?? "#0ea5e9";

  return (
    <div className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 className="section-title">Client Portal Branding</h1>
          <p className="section-subtitle">Customize the white-label experience for your clients</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setPreview(!preview)} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Eye size={14} /> {preview ? "Hide" : "Preview"}
          </button>
          <button onClick={handleSave} className="btn-brand" disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Save size={14} />{saving ? "Saving..." : saved ? "Saved!" : "Save Branding"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: preview ? "1fr 400px" : "1fr", gap: 24 }}>
        {/* Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Logo */}
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Upload size={15} color="#6366f1" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Firm Logo</h3>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ width: 80, height: 80, borderRadius: 12, border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "var(--bg-elevated)", overflow: "hidden" }}>
                {branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <Palette size={24} color="var(--text-muted)" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Logo URL</label>
                <input
                  value={branding.logoUrl ?? ""}
                  onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value || null })}
                  placeholder="https://your-firm.com/logo.png"
                  style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none" }}
                />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Enter a public URL to your logo image (PNG, SVG recommended)</p>
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Palette size={15} color="#8b5cf6" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Brand Colors</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { label: "Primary Color", key: "primaryColor", desc: "Used for buttons, links, highlights" },
                { label: "Secondary Color", key: "secondaryColor", desc: "Used for accents and charts" },
              ].map((field) => (
                <div key={field.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>{field.label}</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="color"
                      value={(branding as Record<string, string | null>)[field.key] ?? "#6366f1"}
                      onChange={(e) => setBranding({ ...branding, [field.key]: e.target.value })}
                      style={{ width: 48, height: 40, padding: 2, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}
                    />
                    <input
                      value={(branding as Record<string, string | null>)[field.key] ?? ""}
                      onChange={(e) => setBranding({ ...branding, [field.key]: e.target.value || null })}
                      placeholder="#6366f1"
                      style={{ flex: 1, padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none" }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{field.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contact & Footer */}
          <div className="section-card">
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Support & Footer</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Support Email", key: "supportEmail", placeholder: "support@yourfirm.com", type: "email" },
                { label: "Support Phone", key: "supportPhone", placeholder: "+91 98765 43210", type: "tel" },
              ].map((f) => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={(branding as Record<string, string | null>)[f.key] ?? ""}
                    onChange={(e) => setBranding({ ...branding, [f.key]: e.target.value || null })}
                    placeholder={f.placeholder}
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none" }}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Footer Text</label>
                <textarea
                  value={branding.footerText ?? ""}
                  onChange={(e) => setBranding({ ...branding, footerText: e.target.value || null })}
                  placeholder="© 2025 Your Firm Name. All rights reserved."
                  rows={2}
                  style={{ width: "100%", padding: "10px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", outline: "none", resize: "vertical" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        {preview && (
          <div style={{ alignSelf: "flex-start" }}>
            <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {/* Simulated portal header */}
              <div style={{ background: primary, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                {branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.logoUrl} alt="Logo" style={{ height: 28, objectFit: "contain" }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Palette size={14} color="white" />
                  </div>
                )}
                <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>Client Portal</span>
              </div>

              <div style={{ padding: 20, background: "var(--bg-surface)" }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Welcome back!</p>

                <div style={{ padding: "12px 14px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>GST Filing — Q1 2025</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Due: 15 Apr 2025</p>
                  <div style={{ marginTop: 8, height: 4, background: "var(--bg-surface)", borderRadius: 99 }}>
                    <div style={{ width: "60%", height: "100%", background: primary, borderRadius: 99 }} />
                  </div>
                </div>

                <button style={{ width: "100%", padding: "10px", borderRadius: 8, background: primary, color: "white", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer", marginBottom: 8 }}>
                  View Tasks
                </button>
                <button style={{ width: "100%", padding: "10px", borderRadius: 8, background: secondary, color: "white", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}>
                  Upload Documents
                </button>
              </div>

              {/* Footer */}
              <div style={{ padding: "10px 16px", background: "var(--bg-elevated)", borderTop: "1px solid var(--border)" }}>
                {(branding.supportEmail || branding.supportPhone) && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                    {branding.supportEmail} {branding.supportPhone && `· ${branding.supportPhone}`}
                  </p>
                )}
                <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{branding.footerText ?? "© 2025 Your Firm"}</p>
              </div>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 8 }}>Live preview of client portal</p>
          </div>
        )}
      </div>
    </div>
  );
}
