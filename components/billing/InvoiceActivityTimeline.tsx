"use client";

import { useEffect, useState } from "react";
import {
  FilePlus,
  RefreshCcw,
  FileText,
  CreditCard,
  Mail,
  Share2,
  Eye,
  Pencil,
  FileMinus,
  Repeat,
  Activity as ActivityIcon,
} from "lucide-react";
import { formatDateTime } from "@/lib/formatters/date";

interface ActivityRow {
  id: string;
  type: string;
  message: string;
  actorName: string | null;
  createdAt: string;
}

const ICONS: Record<string, typeof ActivityIcon> = {
  CREATED: FilePlus,
  STATUS_CHANGED: RefreshCcw,
  UPDATED: Pencil,
  PDF_GENERATED: FileText,
  PAYMENT_RECORDED: CreditCard,
  EMAIL_SENT: Mail,
  SHARED: Share2,
  VIEWED: Eye,
  CREDIT_NOTE: FileMinus,
  RECURRING: Repeat,
};

const COLORS: Record<string, string> = {
  CREATED: "#6366f1",
  STATUS_CHANGED: "#3b82f6",
  UPDATED: "#8b5cf6",
  PDF_GENERATED: "#06b6d4",
  PAYMENT_RECORDED: "#10b981",
  EMAIL_SENT: "#f59e0b",
  SHARED: "#ec4899",
  VIEWED: "#94a3b8",
  CREDIT_NOTE: "#ef4444",
  RECURRING: "#14b8a6",
};

export default function InvoiceActivityTimeline({
  invoiceId,
  refreshKey = 0,
}: {
  invoiceId: string;
  refreshKey?: number;
}) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/invoices/${invoiceId}/activity`);
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (!cancelled) setRows((data.activities ?? []) as ActivityRow[]);
      } catch {
        /* timeline is non-critical */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId, refreshKey]);

  if (loading && rows.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>Loading activity…</p>;
  }

  if (rows.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>No activity recorded yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((row, idx) => {
        const Icon = ICONS[row.type] ?? ActivityIcon;
        const color = COLORS[row.type] ?? "#94a3b8";
        const last = idx === rows.length - 1;
        return (
          <div key={row.id} style={{ display: "flex", gap: 12 }}>
            {/* Rail */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: `${color}1a`, border: `1px solid ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={13} color={color} />
              </div>
              {!last && <div style={{ width: 1, flex: 1, minHeight: 18, background: "var(--border)", marginTop: 2 }} />}
            </div>
            {/* Body */}
            <div style={{ paddingBottom: last ? 0 : 16, flex: 1 }}>
              <p style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{row.message}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {formatDateTime(row.createdAt)}
                {row.actorName ? ` · ${row.actorName}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
