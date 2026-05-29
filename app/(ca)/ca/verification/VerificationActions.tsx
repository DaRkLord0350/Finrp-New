"use client";

import { useState } from "react";
import { CheckCircle, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  documentId: string;
}

export default function VerificationActions({ documentId }: Props) {
  const [loading, setLoading] = useState<"approve" | "reject" | "changes" | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [comment, setComment] = useState("");

  async function handleAction(action: "approve" | "reject" | "changes") {
    if ((action === "reject" || action === "changes") && !comment.trim()) {
      toast.error("Please enter a comment/reason");
      return;
    }
    setLoading(action);
    try {
      const res = await fetch(`/api/ca/verification/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          comment: comment.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(
        action === "approve"
          ? "Document approved"
          : action === "reject"
          ? "Document rejected"
          : "Changes requested"
      );
      // Reload to show updated state
      window.location.reload();
    } catch {
      toast.error("Action failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  if (showRejectForm) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 240 }}>
        <textarea
          placeholder="Enter reason / required changes..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="input"
          style={{ resize: "vertical", fontSize: 12 }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="btn-brand"
            style={{ flex: 1, fontSize: 12, padding: "6px 10px", background: "#ef4444", justifyContent: "center" }}
            onClick={() => handleAction("reject")}
            disabled={!!loading}
          >
            {loading === "reject" ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
            Reject
          </button>
          <button
            className="btn-brand"
            style={{ flex: 1, fontSize: 12, padding: "6px 10px", background: "#f97316", justifyContent: "center" }}
            onClick={() => handleAction("changes")}
            disabled={!!loading}
          >
            {loading === "changes" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Request Changes
          </button>
          <button
            className="btn-ghost"
            style={{ padding: "6px 10px", fontSize: 12 }}
            onClick={() => setShowRejectForm(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        className="btn-brand"
        style={{ fontSize: 12, padding: "6px 12px", background: "#10b981" }}
        onClick={() => handleAction("approve")}
        disabled={!!loading}
        title="Approve document"
      >
        {loading === "approve" ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
        Approve
      </button>
      <button
        className="btn-ghost"
        style={{ fontSize: 12, padding: "6px 12px" }}
        onClick={() => setShowRejectForm(true)}
        disabled={!!loading}
        title="Reject or request changes"
      >
        <XCircle size={13} />
        Reject
      </button>
    </div>
  );
}
