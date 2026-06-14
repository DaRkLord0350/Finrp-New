"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Wallet } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAccountTree, type AccountTreeNode } from "@/hooks/useChartOfAccounts";

function formatCurrency(value: number): string {
  return value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

function TreeRow({ node, depth }: { node: AccountTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 12px",
          paddingLeft: 12 + depth * 22,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => hasChildren && setExpanded((v) => !v)}
          style={{
            width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
            background: "none", border: "none", cursor: hasChildren ? "pointer" : "default",
            color: "var(--text-muted)", flexShrink: 0,
          }}
        >
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </button>
        <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, color: "var(--text-secondary)", minWidth: 64 }}>
          {node.code}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
          {node.name}
        </span>
        {node.isSystemGenerated && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--brand-400)", background: "rgba(99,102,241,0.12)", padding: "2px 7px", borderRadius: 20 }}>
            System
          </span>
        )}
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{node.accountSubType ?? node.type}</span>
        <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", minWidth: 120, textAlign: "right" }}>
          {formatCurrency(node.balance)}
        </span>
        <StatusBadge status={node.isActive ? "active" : "inactive"} />
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AccountTreeView() {
  const { tree, loading } = useAccountTree();

  if (loading) {
    return (
      <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
        Loading account hierarchy…
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "48px 24px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Wallet size={24} color="var(--brand-400)" />
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No accounts to display</p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
          Add accounts to see the hierarchy here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 720 }}>
        {tree.map((node) => (
          <TreeRow key={node.id} node={node} depth={0} />
        ))}
      </div>
    </div>
  );
}
