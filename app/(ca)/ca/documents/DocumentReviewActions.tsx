"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  documentId: string;
}

export default function DocumentReviewActions({ documentId }: Props) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [comment, setComment] = useState("");
  const router = useRouter();

  const handleApprove = async () => {
    setLoading("approve");
    try {
      await fetch(`/api/ca/verification/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", comment: "" }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading("reject");
    try {
      await fetch(`/api/ca/verification/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", comment }),
      });
      setShowRejectModal(false);
      router.refresh();
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={handleApprove}
          disabled={loading !== null}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            borderRadius: 8,
            background: "rgba(16,185,129,0.12)",
            border: "1px solid rgba(16,185,129,0.3)",
            color: "#10b981",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
            transition: "all 0.15s ease",
          }}
        >
          <CheckCircle2 size={12} />
          {loading === "approve" ? "..." : "Approve"}
        </button>
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading !== null}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#ef4444",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
            transition: "all 0.15s ease",
          }}
        >
          <XCircle size={12} />
          Reject
        </button>
      </div>

      {showRejectModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowRejectModal(false); }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 24,
              width: "100%",
              maxWidth: 400,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Reject Document</h3>
              <button onClick={() => setShowRejectModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                <X size={16} />
              </button>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Reason for rejection (optional)"
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 13,
                color: "var(--text-primary)",
                outline: "none",
                resize: "vertical",
                marginBottom: 16,
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowRejectModal(false)} className="btn-ghost">Cancel</button>
              <button
                onClick={handleReject}
                disabled={loading !== null}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "#ef4444",
                  border: "none",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading === "reject" ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
