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

  // Lending Platform (Phase 3, Module 1)
  IN_PROGRESS:           { bg: "#3b82f6", text: "In Progress" },
  ON_HOLD:                { bg: "#f97316", text: "On Hold" },
  CONDITIONALLY_APPROVED: { bg: "#8b5cf6", text: "Conditional Approval" },
  WITHDRAWN:              { bg: "#6b7280", text: "Withdrawn" },
  SANCTIONED:             { bg: "#06b6d4", text: "Sanctioned" },
  DISBURSED:              { bg: "#10b981", text: "Disbursed" },
  CLOSED:                 { bg: "#6b7280", text: "Closed" },
  FORECLOSED:             { bg: "#0ea5e9", text: "Foreclosed" },
  WRITTEN_OFF:            { bg: "#ef4444", text: "Written Off" },
  NPA_SUBSTANDARD:        { bg: "#f59e0b", text: "NPA (Substandard)" },
  NPA_DOUBTFUL:           { bg: "#f97316", text: "NPA (Doubtful)" },
  NPA_LOSS:               { bg: "#ef4444", text: "NPA (Loss)" },
  UPCOMING:               { bg: "#6b7280", text: "Upcoming" },
  DUE:                    { bg: "#f59e0b", text: "Due" },
  PARTIALLY_PAID:         { bg: "#3b82f6", text: "Partially Paid" },
  WAIVED:                 { bg: "#8b5cf6", text: "Waived" },
  PENDING:                { bg: "#f59e0b", text: "Pending" },
  SKIPPED:                { bg: "#6b7280", text: "Skipped" },
  VERIFIED:               { bg: "#10b981", text: "Verified" },
  OPEN:                   { bg: "#3b82f6", text: "Open" },
  PROMISE_TO_PAY:         { bg: "#8b5cf6", text: "Promise to Pay" },
  RESOLVED:               { bg: "#10b981", text: "Resolved" },
  ESCALATED:              { bg: "#ef4444", text: "Escalated" },
  PROCESSING:             { bg: "#3b82f6", text: "Processing" },
  INITIATED:              { bg: "#6b7280", text: "Initiated" },
  SUCCESS:                { bg: "#10b981", text: "Success" },
  FAILED:                 { bg: "#ef4444", text: "Failed" },
  BOUNCED:                { bg: "#ef4444", text: "Bounced" },
  REVERSED:               { bg: "#f97316", text: "Reversed" },
  ISSUED:                 { bg: "#3b82f6", text: "Issued" },
  ACCEPTED:               { bg: "#10b981", text: "Accepted" },
  DECLINED:               { bg: "#ef4444", text: "Declined" },
  SUPERSEDED:             { bg: "#6b7280", text: "Superseded" },
  SENT_FOR_SIGNATURE:     { bg: "#3b82f6", text: "Sent for Signature" },
  PARTIALLY_SIGNED:       { bg: "#f59e0b", text: "Partially Signed" },
  FULLY_SIGNED:           { bg: "#10b981", text: "Fully Signed" },
  EXECUTED:               { bg: "#10b981", text: "Executed" },
  VOIDED:                 { bg: "#6b7280", text: "Voided" },
  LOW:                    { bg: "#10b981", text: "Low" },
  MEDIUM:                 { bg: "#f59e0b", text: "Medium" },
  HIGH:                   { bg: "#f97316", text: "High" },
  CRITICAL:               { bg: "#ef4444", text: "Critical" },

  // AML (Phase 3, Module 3)
  CLEARED:                { bg: "#10b981", text: "Cleared" },
  CONFIRMED_SAR:          { bg: "#7f1d1d", text: "SAR Filed" },
  FALSE_POSITIVE:         { bg: "#6b7280", text: "False Positive" },
  NO_MATCH:               { bg: "#10b981", text: "No Match" },
  POTENTIAL_MATCH:        { bg: "#f59e0b", text: "Potential Match" },
  CONFIRMED_MATCH:        { bg: "#ef4444", text: "Confirmed Match" },
  REVIEWED:               { bg: "#3b82f6", text: "Reviewed" },
  DISMISSED:              { bg: "#6b7280", text: "Dismissed" },

  // Fraud (Phase 3, Module 4)
  CONFIRMED_FRAUD:        { bg: "#7f1d1d", text: "Confirmed Fraud" },

  // Continuous Monitoring (Phase 3, Module 6)
  ACKNOWLEDGED:           { bg: "#3b82f6", text: "Acknowledged" },
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
