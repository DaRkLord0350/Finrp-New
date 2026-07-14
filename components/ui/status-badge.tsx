import { cn } from "@/lib/utils";

const VARIANTS = {
  // Generic lifecycle
  active:   { bg: "#10b981", text: "Active" },
  inactive: { bg: "#6b7280", text: "Inactive" },
  pending:  { bg: "#f59e0b", text: "Pending" },
  error:    { bg: "#ef4444", text: "Error" },

  // Invoice statuses
  DRAFT:      { bg: "#6b7280", text: "Draft" },
  SENT:       { bg: "#3b82f6", text: "Sent" },
  VIEWED:     { bg: "#8b5cf6", text: "Viewed" },
  PAID:       { bg: "#10b981", text: "Paid" },
  PARTIAL:    { bg: "#f59e0b", text: "Partial" },
  OVERDUE:    { bg: "#ef4444", text: "Overdue" },
  CANCELLED:  { bg: "#6b7280", text: "Cancelled" },

  // Compliance
  SUBMITTED:      { bg: "#3b82f6", text: "Submitted" },
  UNDER_REVIEW:   { bg: "#f59e0b", text: "Under Review" },
  APPROVED:       { bg: "#10b981", text: "Approved" },
  REJECTED:       { bg: "#ef4444", text: "Rejected" },
  EXPIRED:        { bg: "#6b7280", text: "Expired" },
  COMPLETED:      { bg: "#10b981", text: "Completed" },
  PENDING_RENEWAL:{ bg: "#f97316", text: "Renewal Due" },

  // Loan
  UNDER_REVIEW_2: { bg: "#f59e0b", text: "Under Review" },
  ACTIVE:         { bg: "#10b981", text: "Active" },
  DEFAULTED:      { bg: "#ef4444", text: "Defaulted" },

  // KYC (Module 7)
  VERIFICATION_PENDING: { bg: "#f59e0b", text: "Verification Pending" },
  KYC_PENDING:           { bg: "#8b5cf6", text: "Awaiting Approval" },
  SUSPENDED:             { bg: "#ef4444", text: "Suspended" },
} as const;

interface StatusBadgeProps {
  status: string;
  customLabel?: string;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({ status, customLabel, size = "sm", className }: StatusBadgeProps) {
  const variant = VARIANTS[status as keyof typeof VARIANTS];
  const color = variant?.bg ?? "#6b7280";
  const label = customLabel ?? variant?.text ?? status;

  return (
    <span
      className={cn(className)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: size === "sm" ? "3px 9px" : "5px 12px",
        borderRadius: 20,
        background: `${color}18`,
        border: `1px solid ${color}30`,
        fontSize: size === "sm" ? 11 : 12,
        fontWeight: 600,
        color,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 5, height: 5, borderRadius: "50%",
          background: color, flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
