"use client";

// ============================================================
// CustomerSwitcher — switch between assigned client workspaces
// without leaving impersonation mode. Lazy-loads the openable
// client list on first open; switching POSTs to
// /api/ca/workspace (audited as WORKSPACE_SWITCH) and hard-
// navigates so no client-side cache leaks across orgs.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Loader2, Search } from "lucide-react";

interface SwitcherClient {
  organizationId: string;
  name: string;
  businessType: string | null;
  gstin: string | null;
}

interface CustomerSwitcherProps {
  currentOrgId: string;
  currentName: string;
}

export default function CustomerSwitcher({ currentOrgId, currentName }: CustomerSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<SwitcherClient[] | null>(null);
  const [query, setQuery] = useState("");
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || clients) return;
    let cancelled = false;
    fetch("/api/ca/workspace/clients")
      .then((res) => (res.ok ? res.json() : { clients: [] }))
      .then((data) => {
        if (!cancelled) setClients(data.clients ?? []);
      })
      .catch(() => {
        if (!cancelled) setClients([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, clients]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const switchTo = async (organizationId: string) => {
    if (organizationId === currentOrgId || switchingTo) return;
    setSwitchingTo(organizationId);
    try {
      const res = await fetch("/api/ca/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) {
        setSwitchingTo(null);
        return;
      }
      const data = await res.json();
      window.location.assign(data?.redirect ?? "/dashboard");
    } catch {
      setSwitchingTo(null);
    }
  };

  const filtered = (clients ?? []).filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.35)",
          background: "rgba(255,255,255,0.12)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          maxWidth: 280,
          minWidth: 0,
        }}
      >
        <Building2 size={14} style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {currentName}
        </span>
        <ChevronDown
          size={14}
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: 320,
            maxHeight: 380,
            overflowY: "auto",
            background: "var(--bg-surface, #18181b)",
            border: "1px solid var(--border, #27272a)",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
            zIndex: 200,
            padding: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid var(--border, #27272a)",
              marginBottom: 6,
            }}
          >
            <Search size={13} color="var(--text-muted)" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: 13,
              }}
            />
          </div>

          {clients === null ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 14, color: "var(--text-muted)", fontSize: 13 }}>
              <Loader2 size={14} className="animate-spin" /> Loading clients…
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ padding: 14, fontSize: 13, color: "var(--text-muted)" }}>
              No clients found.
            </p>
          ) : (
            filtered.map((c) => {
              const isCurrent = c.organizationId === currentOrgId;
              const isSwitching = switchingTo === c.organizationId;
              return (
                <button
                  key={c.organizationId}
                  onClick={() => switchTo(c.organizationId)}
                  disabled={isCurrent || !!switchingTo}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: isCurrent ? "rgba(99,102,241,0.12)" : "transparent",
                    cursor: isCurrent ? "default" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #6366f1, #0ea5e9)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Building2 size={14} color="white" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.name}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {c.gstin ?? c.businessType ?? "—"}
                    </p>
                  </div>
                  {isCurrent && <Check size={14} color="#818cf8" style={{ flexShrink: 0 }} />}
                  {isSwitching && (
                    <Loader2 size={14} color="var(--text-muted)" className="animate-spin" style={{ flexShrink: 0 }} />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
