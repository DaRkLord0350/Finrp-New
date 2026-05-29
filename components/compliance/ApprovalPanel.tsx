"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, MessageSquare, ArrowUpCircle, ChevronDown } from "lucide-react";
import type { ComplianceApprovalAction, ComplianceApprovalRecord } from "@/types/compliance";

interface Props {
  submissionId: string;
  submissionStatus: string;
  approvals: ComplianceApprovalRecord[];
  onApprove: (action: ComplianceApprovalAction, comments?: string, conditions?: string) => Promise<void>;
}

const ACTION_CONFIG = {
  APPROVE: {
    label: "Approve",
    icon: <CheckCircle size={14} />,
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.3)",
  },
  REJECT: {
    label: "Reject",
    icon: <XCircle size={14} />,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.3)",
  },
  REQUEST_CHANGES: {
    label: "Request Changes",
    icon: <MessageSquare size={14} />,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.3)",
  },
  ESCALATE: {
    label: "Escalate",
    icon: <ArrowUpCircle size={14} />,
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
    border: "rgba(139,92,246,0.3)",
  },
} as const;

const canReview = (status: string) =>
  status === "SUBMITTED" || status === "UNDER_REVIEW";

export default function ApprovalPanel({
  submissionId,
  submissionStatus,
  approvals,
  onApprove,
}: Props) {
  const [selectedAction, setSelectedAction] = useState<ComplianceApprovalAction | null>(null);
  const [comments, setComments] = useState("");
  const [conditions, setConditions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const handleSubmit = async () => {
    if (!selectedAction) return;
    setSubmitting(true);
    setError(null);
    try {
      await onApprove(selectedAction, comments || undefined, conditions || undefined);
      setSelectedAction(null);
      setComments("");
      setConditions("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
          Approval Workflow
        </h3>
      </div>

      <div style={{ padding: "16px 18px" }}>
        {canReview(submissionStatus) ? (
          <>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              Select an action for this submission:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {(Object.keys(ACTION_CONFIG) as ComplianceApprovalAction[]).map((action) => {
                const cfg = ACTION_CONFIG[action];
                const selected = selectedAction === action;
                return (
                  <button
                    key={action}
                    onClick={() => setSelectedAction(selected ? null : action)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: `1px solid ${selected ? cfg.color : "var(--border)"}`,
                      background: selected ? cfg.bg : "var(--bg-elevated)",
                      color: selected ? cfg.color : "var(--text-secondary)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {selectedAction && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div>
                  <label className="label">
                    Comments {selectedAction === "APPROVE" ? "(optional)" : "(required for rejection/changes)"}
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder={
                      selectedAction === "APPROVE"
                        ? "Add approval notes (optional)"
                        : selectedAction === "REJECT"
                        ? "State the reason for rejection"
                        : "Describe the changes required"
                    }
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    style={{ resize: "vertical" }}
                  />
                </div>

                {selectedAction === "APPROVE" && (
                  <div>
                    <label className="label">Conditions (optional)</label>
                    <input
                      className="input"
                      placeholder="Any conditions attached to approval"
                      value={conditions}
                      onChange={(e) => setConditions(e.target.value)}
                    />
                  </div>
                )}

                {error && (
                  <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn-ghost"
                    onClick={() => { setSelectedAction(null); setComments(""); setConditions(""); setError(null); }}
                    style={{ flex: 1 }}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={
                      submitting ||
                      ((selectedAction === "REJECT" || selectedAction === "REQUEST_CHANGES") && !comments.trim())
                    }
                    style={{
                      flex: 1,
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${ACTION_CONFIG[selectedAction].color}`,
                      background: ACTION_CONFIG[selectedAction].bg,
                      color: ACTION_CONFIG[selectedAction].color,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: submitting ? "not-allowed" : "pointer",
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    {submitting ? "Processing…" : `Confirm ${ACTION_CONFIG[selectedAction].label}`}
                  </button>
                </div>
              </motion.div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
            No review actions available for current status
          </p>
        )}
      </div>

      {/* History */}
      {approvals.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => setShowHistory((v) => !v)}
            style={{
              width: "100%",
              padding: "12px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Approval History ({approvals.length})
            <ChevronDown
              size={14}
              style={{ transform: showHistory ? "rotate(180deg)" : "none", transition: "0.2s" }}
            />
          </button>

          {showHistory && (
            <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {approvals.map((a) => {
                const cfg = ACTION_CONFIG[a.action];
                return (
                  <div
                    key={a.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${cfg.border}`,
                      background: cfg.bg,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, color: cfg.color, fontSize: 12, fontWeight: 700 }}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {formatDate(a.approvedAt)}
                      </span>
                    </div>
                    {a.comments && (
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                        {a.comments}
                      </p>
                    )}
                    {a.conditions && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>
                        Conditions: {a.conditions}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
