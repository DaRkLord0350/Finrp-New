"use client";

import { useEffect, useState } from "react";
import { X, Link2, Copy, Check, Trash2, Eye, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatters/date";

interface ShareLink {
  id: string;
  token: string;
  hasPassword: boolean;
  expiresAt: string | null;
  isActive: boolean;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
}

const inputStyle = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  padding: "9px 12px",
  fontSize: 14,
  width: "100%",
  outline: "none",
} as const;

const labelStyle = {
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 500 as const,
  marginBottom: 6,
  display: "block" as const,
};

export default function ShareModal({
  invoiceId,
  invoiceNumber,
  onClose,
}: {
  invoiceId: string;
  invoiceNumber: string;
  onClose: () => void;
}) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState("0");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const urlFor = (token: string) => `${origin}/i/${token}`;

  const fetchLinks = async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/share`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setLinks((data.links ?? []) as ShareLink[]);
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createLink = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInDays: Number(expiresInDays), password: password.trim() || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to create link");
      }
      const data = await res.json();
      setLinks((prev) => [data.link as ShareLink, ...prev]);
      setPassword("");
      setExpiresInDays("0");
      toast.success("Share link created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create link");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (link: ShareLink) => {
    try {
      await navigator.clipboard.writeText(urlFor(link.token));
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const toggleActive = async (link: ShareLink) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/share/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !link.isActive }),
      });
      if (!res.ok) throw new Error("failed");
      setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, isActive: !l.isActive } : l)));
    } catch {
      toast.error("Couldn't update link");
    }
  };

  const deleteLink = async (link: ShareLink) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/share/${link.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      setLinks((prev) => prev.filter((l) => l.id !== link.id));
      toast.success("Link deleted");
    } catch {
      toast.error("Couldn't delete link");
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20, overflowY: "auto" }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 560, boxShadow: "var(--shadow-lg)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
              <Link2 size={17} /> Share Invoice
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{invoiceNumber} · public secure links</p>
          </div>
          <button onClick={onClose} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
            <X size={16} />
          </button>
        </div>

        {/* Create */}
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 18, flexShrink: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Expires</label>
              <select value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} style={inputStyle}>
                <option value="0">Never</option>
                <option value="7">In 7 days</option>
                <option value="30">In 30 days</option>
                <option value="90">In 90 days</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Password (optional)</label>
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank for none" style={inputStyle} />
            </div>
          </div>
          <button onClick={createLink} disabled={creating} className="btn-brand" style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={15} /> {creating ? "Creating…" : "Create Share Link"}
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 16 }}>Loading links…</p>
          ) : links.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 16 }}>No share links yet. Create one above.</p>
          ) : (
            links.map((link) => (
              <div key={link.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "var(--bg-elevated)", opacity: link.isActive ? 1 : 0.6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input readOnly value={urlFor(link.token)} style={{ ...inputStyle, fontSize: 12, fontFamily: "monospace", padding: "7px 10px" }} onFocus={(e) => e.target.select()} />
                  <button onClick={() => copyLink(link)} className="btn-ghost" style={{ padding: "7px 10px", flexShrink: 0 }} title="Copy">
                    {copiedId === link.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Eye size={12} /> {link.viewCount} view{link.viewCount === 1 ? "" : "s"}
                  </span>
                  {link.hasPassword && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Lock size={12} /> Protected
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: link.expiresAt ? "#f59e0b" : "var(--text-muted)" }}>
                    {link.expiresAt ? `Expires ${formatDate(link.expiresAt)}` : "No expiry"}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: link.isActive ? "#10b981" : "#ef4444" }}>
                    {link.isActive ? "Active" : "Disabled"}
                  </span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button onClick={() => toggleActive(link)} className="btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }}>
                      {link.isActive ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => deleteLink(link)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
