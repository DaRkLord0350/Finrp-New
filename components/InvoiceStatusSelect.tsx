"use client";

import { ChevronDown } from "lucide-react";
import {
  INVOICE_STATUS_ORDER,
  getInvoiceStatusMeta,
  isValidInvoiceStatus,
} from "@/lib/invoice-status";

interface InvoiceStatusSelectProps {
  value: string;
  onChange: (next: string) => void;
  /** Disable + show a wait cursor while a change is being persisted. */
  pending?: boolean;
  /** Visually disable without the "pending" affordance (e.g. no permission). */
  disabled?: boolean;
}

// ── Inline, color-coded invoice status dropdown ───────────────
// Replaces a static status badge so users can change an invoice's
// status in place. Persistence (optimistic update + rollback) is the
// caller's responsibility via its onChange handler.
export default function InvoiceStatusSelect({
  value,
  onChange,
  pending,
  disabled,
}: InvoiceStatusSelectProps) {
  const meta = getInvoiceStatusMeta(value);
  const isDisabled = pending || disabled;

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <select
        value={isValidInvoiceStatus(value) ? value : ""}
        disabled={isDisabled}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Invoice status"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          padding: "4px 26px 4px 11px",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.4,
          color: meta.color,
          background: `${meta.color}15`,
          border: `1px solid ${meta.color}30`,
          cursor: isDisabled ? (pending ? "wait" : "not-allowed") : "pointer",
          outline: "none",
          opacity: pending ? 0.6 : 1,
          transition: "all 0.15s ease",
        }}
      >
        {!isValidInvoiceStatus(value) && (
          <option value="" disabled>
            {value}
          </option>
        )}
        {INVOICE_STATUS_ORDER.map((s) => (
          <option
            key={s}
            value={s}
            style={{ color: "var(--text-primary)", background: "var(--bg-surface)" }}
          >
            {getInvoiceStatusMeta(s).label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          color: meta.color,
          opacity: 0.8,
        }}
      />
    </div>
  );
}
