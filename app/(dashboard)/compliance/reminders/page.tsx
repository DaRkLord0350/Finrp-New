"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Plus,
  RefreshCw,
  ChevronRight,
  Bell,
  BellOff,
  BellRing,
  Calendar,
  CheckCheck,
  Trash2,
  ChevronRight as LinkArrow,
  Clock,
  AlertTriangle,
  Filter,
  X,
} from "lucide-react";
import { useComplianceReminders } from "@/hooks/useComplianceReminders";
import { useComplianceSubmissions } from "@/hooks/useComplianceSubmissions";
import type {
  ComplianceReminderRecord,
  ComplianceReminderType,
  CreateComplianceReminderInput,
} from "@/types/compliance";
import { format, isPast, differenceInDays, parseISO } from "date-fns";

// ── Reminder type labels & colors ─────────────────────────────
const TYPE_META: Record<ComplianceReminderType, { label: string; color: string; icon: string }> = {
  DUE_DATE:            { label: "Due Date",         color: "#ef4444", icon: "📅" },
  EXPIRY:              { label: "Expiry",            color: "#f59e0b", icon: "⏳" },
  PENDING_APPROVAL:    { label: "Pending Approval",  color: "#3b82f6", icon: "👀" },
  REJECTED_FOLLOW_UP:  { label: "Rejected",          color: "#ef4444", icon: "🔄" },
  RENEWAL:             { label: "Renewal",           color: "#10b981", icon: "♻️" },
  CUSTOM:              { label: "Custom",            color: "#8b5cf6", icon: "🔔" },
};

// ── Create Reminder Modal ──────────────────────────────────────
function ReminderFormModal({
  onClose,
  onSubmit,
  submissionOptions,
}: {
  onClose: () => void;
  onSubmit: (data: CreateComplianceReminderInput) => Promise<void>;
  submissionOptions: { id: string; title: string }[];
}) {
  const [form, setForm] = useState<CreateComplianceReminderInput>({
    type: "CUSTOM",
    title: "",
    message: "",
    reminderDate: "",
    submissionId: undefined,
    assignedToId: undefined,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required"); return; }
    if (!form.reminderDate) { setError("Reminder date is required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        reminderDate: new Date(form.reminderDate).toISOString(),
        submissionId: form.submissionId || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: 16, width: "100%", maxWidth: 480,
          maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>New Reminder</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18, padding: 4 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Type */}
          <div>
            <label className="label">Type *</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ComplianceReminderType }))}
            >
              {(Object.keys(TYPE_META) as ComplianceReminderType[]).map((t) => (
                <option key={t} value={t}>{TYPE_META[t].icon} {TYPE_META[t].label}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="label">Title *</label>
            <input
              className="input" placeholder="e.g. GST Q1 filing due soon"
              value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required
            />
          </div>

          {/* Message */}
          <div>
            <label className="label">Message</label>
            <textarea
              className="input" rows={2} placeholder="Optional details or action required"
              value={form.message ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              style={{ resize: "vertical" }}
            />
          </div>

          {/* Reminder date */}
          <div>
            <label className="label">Reminder Date & Time *</label>
            <input
              className="input" type="datetime-local"
              value={form.reminderDate}
              onChange={(e) => setForm((p) => ({ ...p, reminderDate: e.target.value }))}
              required
            />
          </div>

          {/* Linked submission */}
          {submissionOptions.length > 0 && (
            <div>
              <label className="label">Linked Submission</label>
              <select
                className="input"
                value={form.submissionId ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, submissionId: e.target.value || undefined }))}
              >
                <option value="">None (standalone reminder)</option>
                {submissionOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p style={{ fontSize: 13, color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "8px 12px", borderRadius: 8 }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-brand" style={{ flex: 2 }} disabled={submitting}>
              {submitting ? "Creating…" : "Create Reminder"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Reminder Card ──────────────────────────────────────────────
function ReminderCard({
  reminder,
  onDismiss,
  onTrigger,
  onDelete,
}: {
  reminder: ComplianceReminderRecord;
  onDismiss: () => void;
  onTrigger: () => void;
  onDelete: () => void;
}) {
  const meta = TYPE_META[reminder.type] ?? TYPE_META.CUSTOM;
  const date = parseISO(reminder.reminderDate);
  const overdue = isPast(date) && !reminder.isTriggered && reminder.isActive;
  const daysLeft = differenceInDays(date, new Date());

  let urgencyColor = meta.color;
  if (reminder.isTriggered) urgencyColor = "#6b7280";
  else if (!reminder.isActive) urgencyColor = "#6b7280";
  else if (overdue) urgencyColor = "#ef4444";
  else if (daysLeft <= 3) urgencyColor = "#f97316";
  else if (daysLeft <= 7) urgencyColor = "#f59e0b";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${(overdue && !reminder.isTriggered) ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        opacity: (reminder.isTriggered || !reminder.isActive) ? 0.65 : 1,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${urgencyColor}14`, border: `1.5px solid ${urgencyColor}30`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
        }}
      >
        {meta.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{reminder.title}</span>
          <span
            style={{
              fontSize: 10, fontWeight: 700, color: meta.color,
              background: `${meta.color}14`, border: `1px solid ${meta.color}30`,
              padding: "1px 6px", borderRadius: 99,
            }}
          >
            {meta.label}
          </span>
          {reminder.isTriggered && (
            <span style={{ fontSize: 10, color: "#6b7280", background: "rgba(107,114,128,0.1)", padding: "1px 6px", borderRadius: 99 }}>
              Triggered
            </span>
          )}
          {!reminder.isActive && !reminder.isTriggered && (
            <span style={{ fontSize: 10, color: "#6b7280", background: "rgba(107,114,128,0.1)", padding: "1px 6px", borderRadius: 99 }}>
              Dismissed
            </span>
          )}
        </div>

        {reminder.message && (
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, lineHeight: 1.5 }}>{reminder.message}</p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Date */}
          <span
            style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 12, color: urgencyColor, fontWeight: overdue ? 700 : 400,
            }}
          >
            {overdue ? <AlertTriangle size={11} /> : <Clock size={11} />}
            {overdue ? "Overdue · " : ""}
            {format(date, "MMM d, yyyy 'at' h:mm a")}
            {!overdue && !reminder.isTriggered && daysLeft >= 0 && (
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                ({daysLeft === 0 ? "today" : `in ${daysLeft}d`})
              </span>
            )}
          </span>

          {/* Linked submission */}
          {reminder.submission && (
            <Link
              href={`/compliance/submissions/${reminder.submission.id}`}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 12, color: "#6366f1", textDecoration: "none", fontWeight: 500,
              }}
            >
              <LinkArrow size={11} />
              {reminder.submission.title}
            </Link>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {!reminder.isTriggered && reminder.isActive && (
          <>
            <button
              onClick={onTrigger}
              title="Mark as triggered"
              style={{
                background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)",
                borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#6366f1",
                display: "flex", alignItems: "center", gap: 4, fontSize: 12,
              }}
            >
              <BellRing size={12} /> Trigger
            </button>
            <button
              onClick={onDismiss}
              title="Dismiss reminder"
              style={{
                background: "none", border: "1px solid var(--border)", borderRadius: 7,
                padding: "5px 8px", cursor: "pointer", color: "var(--text-muted)",
                display: "flex", alignItems: "center", gap: 4, fontSize: 12,
              }}
            >
              <BellOff size={12} /> Dismiss
            </button>
          </>
        )}
        <button
          onClick={onDelete}
          title="Delete reminder"
          style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 7,
            padding: "5px 8px", cursor: "pointer", color: "#ef4444",
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function RemindersPage() {
  const [filter, setFilter] = useState<"all" | "pending" | "upcoming">("all");
  const [showForm, setShowForm] = useState(false);

  const {
    reminders, loading, error, refetch,
    createReminder, dismissReminder, triggerReminder, deleteReminder,
  } = useComplianceReminders(filter);

  const { submissions } = useComplianceSubmissions({ pageSize: 100, sortBy: "createdAt", sortOrder: "desc" });

  const submissionOptions = submissions.map((s) => ({ id: s.id, title: s.title }));

  const handleDismiss = async (id: string) => {
    try { await dismissReminder(id); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  };

  const handleTrigger = async (id: string) => {
    try { await triggerReminder(id); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this reminder?")) return;
    try { await deleteReminder(id); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  };

  const handleCreate = async (data: CreateComplianceReminderInput) => {
    await createReminder(data);
    setShowForm(false);
  };

  // Grouped view
  const grouped = {
    overdue: reminders.filter((r) => r.isActive && !r.isTriggered && isPast(parseISO(r.reminderDate))),
    upcoming: reminders.filter((r) => r.isActive && !r.isTriggered && !isPast(parseISO(r.reminderDate))),
    triggered: reminders.filter((r) => r.isTriggered),
    dismissed: reminders.filter((r) => !r.isActive && !r.isTriggered),
  };

  const pendingCount = grouped.overdue.length + grouped.upcoming.length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link href="/compliance" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>Compliance</Link>
            <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>Reminders</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
            Reminder Center
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>
            {reminders.length} reminder{reminders.length !== 1 ? "s" : ""}
            {pendingCount > 0 && ` · `}
            {pendingCount > 0 && (
              <span style={{ color: "#f59e0b", fontWeight: 600 }}>{pendingCount} pending</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={refetch} style={{ padding: "8px 12px" }}>
            <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
          <button className="btn-brand" onClick={() => setShowForm(true)}>
            <Plus size={14} /> New Reminder
          </button>
        </div>
      </div>

      {/* Stats + filter bar */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "12px 16px", flexWrap: "wrap",
        }}
      >
        <Filter size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />

        {(["all", "pending", "upcoming"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600,
              border: filter === f ? "1px solid #6366f1" : "1px solid var(--border)",
              background: filter === f ? "rgba(99,102,241,0.12)" : "transparent",
              color: filter === f ? "#6366f1" : "var(--text-secondary)",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {f === "all" ? "All" : f === "pending" ? "Pending / Overdue" : "Upcoming (30d)"}
          </button>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
          {grouped.overdue.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
              <AlertTriangle size={12} /> {grouped.overdue.length} overdue
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)" }}>
            <CheckCheck size={12} /> {grouped.triggered.length} triggered
          </span>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 88, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : reminders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
          <Bell size={36} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>No reminders</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
            {filter !== "all" ? "No reminders match this filter" : "Create a reminder to stay on top of compliance deadlines"}
          </p>
          {filter === "all" && (
            <button className="btn-brand" onClick={() => setShowForm(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> New Reminder
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Overdue section */}
          {grouped.overdue.length > 0 && (
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={12} /> Overdue ({grouped.overdue.length})
              </h3>
              <AnimatePresence>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {grouped.overdue.map((r) => (
                    <ReminderCard
                      key={r.id}
                      reminder={r}
                      onDismiss={() => handleDismiss(r.id)}
                      onTrigger={() => handleTrigger(r.id)}
                      onDelete={() => handleDelete(r.id)}
                    />
                  ))}
                </div>
              </AnimatePresence>
            </div>
          )}

          {/* Upcoming section */}
          {grouped.upcoming.length > 0 && (
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={12} /> Upcoming ({grouped.upcoming.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {grouped.upcoming.map((r) => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    onDismiss={() => handleDismiss(r.id)}
                    onTrigger={() => handleTrigger(r.id)}
                    onDelete={() => handleDelete(r.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Triggered */}
          {grouped.triggered.length > 0 && (
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCheck size={12} /> Triggered ({grouped.triggered.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {grouped.triggered.map((r) => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    onDismiss={() => handleDismiss(r.id)}
                    onTrigger={() => handleTrigger(r.id)}
                    onDelete={() => handleDelete(r.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Dismissed */}
          {grouped.dismissed.length > 0 && filter === "all" && (
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <BellOff size={12} /> Dismissed ({grouped.dismissed.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {grouped.dismissed.map((r) => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    onDismiss={() => handleDismiss(r.id)}
                    onTrigger={() => handleTrigger(r.id)}
                    onDelete={() => handleDelete(r.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <ReminderFormModal
          onClose={() => setShowForm(false)}
          onSubmit={handleCreate}
          submissionOptions={submissionOptions}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
