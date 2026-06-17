"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Paperclip } from "lucide-react";

const STATUSES = ["PENDING", "IN_PROGRESS", "WAITING_CLIENT", "REVIEW", "COMPLETED"] as const;
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  WAITING_CLIENT: "Waiting Client",
  REVIEW: "Review",
  COMPLETED: "Completed",
};

const MAX_INLINE = 1_500_000;

export function StatusSelect({ taskId, status }: { taskId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    setValue(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/firm/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      toast.success("Status updated");
      router.refresh();
    } catch {
      toast.error("Failed to update status");
      setValue(status);
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      value={value}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      style={{
        padding: "8px 12px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        color: "var(--text-primary)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        outline: "none",
      }}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

export function AddComment({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/firm/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed");
      setText("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to comment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Write a comment…"
        style={{
          flex: 1,
          padding: "10px 12px",
          background: "var(--bg-base)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          color: "var(--text-primary)",
          fontSize: 13,
          outline: "none",
        }}
      />
      <button
        onClick={submit}
        disabled={busy || !text.trim()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 16px",
          background: "#6366f1",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: busy || !text.trim() ? "not-allowed" : "pointer",
          opacity: busy || !text.trim() ? 0.6 : 1,
        }}
      >
        <Send size={14} /> Send
      </button>
    </div>
  );
}

export function AddAttachment({ taskId }: { taskId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File) {
    if (file.size > MAX_INLINE) {
      toast.error("File too large for inline upload (max 1.5MB)");
      return;
    }
    setBusy(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const res = await fetch(`/api/firm/tasks/${taskId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileUrl: dataUrl, fileSize: file.size, mimeType: file.type || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed");
      toast.success("Attachment added");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to attach");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 8,
          color: "var(--text-secondary)",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        <Paperclip size={13} /> {busy ? "Uploading…" : "Attach"}
      </button>
      <input
        ref={ref}
        type="file"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
