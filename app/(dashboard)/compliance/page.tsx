"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Bell,
  BarChart2,
  ChevronRight,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { useComplianceDashboard } from "@/hooks/useComplianceDashboard";
import { useComplianceSubmissions } from "@/hooks/useComplianceSubmissions";
import { useComplianceCategories } from "@/hooks/useComplianceCategories";
import StatusBadge from "@/components/compliance/StatusBadge";
import SubmissionFormModal from "@/components/compliance/SubmissionFormModal";
import { useComplianceTypes } from "@/hooks/useComplianceCategories";
import { useState } from "react";
import type { ComplianceStatus } from "@/types/compliance";
import { format, isPast, differenceInDays } from "date-fns";

const STAT_CARDS = [
  {
    key: "totalSubmissions",
    label: "Total Items",
    icon: ShieldCheck,
    color: "#6366f1",
  },
  {
    key: "pendingApprovals",
    label: "Pending Approvals",
    icon: Clock,
    color: "#f59e0b",
  },
  {
    key: "expiringSoon",
    label: "Expiring Soon",
    icon: AlertTriangle,
    color: "#ef4444",
  },
  {
    key: "overdueFiling",
    label: "Overdue",
    icon: AlertTriangle,
    color: "#ef4444",
  },
  {
    key: "approvedItems",
    label: "Approved",
    icon: CheckCircle,
    color: "#10b981",
  },
  {
    key: "rejectedItems",
    label: "Rejected",
    icon: FileText,
    color: "#6b7280",
  },
] as const;

export default function ComplianceDashboardPage() {
  const { data, loading: dashLoading, error: dashError, refetch } = useComplianceDashboard();
  const { categories } = useComplianceCategories();
  const { types } = useComplianceTypes();
  const { createSubmission, refetch: refetchSubmissions } = useComplianceSubmissions({ pageSize: 1 });
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async (input: Parameters<typeof createSubmission>[0]) => {
    await createSubmission(input);
    setShowForm(false);
    refetch();
    refetchSubmissions();
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Compliance
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
            Monitor regulatory filings, approvals, and compliance deadlines across your organization.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={refetch} style={{ padding: "8px 12px" }}>
            <RefreshCw size={14} style={dashLoading ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
          <button className="btn-brand" onClick={() => setShowForm(true)}>
            <Plus size={15} /> New Submission
          </button>
        </div>
      </div>

      {dashError && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 20 }}>
          {dashError}{" "}
          <button onClick={refetch} style={{ color: "#ef4444", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      )}

      {/* Quick-nav Sub-pages */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {[
          { label: "All Submissions", href: "/compliance/submissions", icon: FileText, color: "#6366f1" },
          { label: "Categories", href: "/compliance/categories", icon: BarChart2, color: "#3b82f6" },
          { label: "Reminders", href: "/compliance/reminders", icon: Bell, color: "#f59e0b" },
          { label: "Audit Logs", href: "/compliance/audit", icon: TrendingUp, color: "#10b981" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={14} color={item.color} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.label}</span>
              <ChevronRight size={12} style={{ color: "var(--text-muted)", marginLeft: "auto" }} />
            </Link>
          );
        })}
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
        {STAT_CARDS.map((card, i) => {
          const Icon = card.icon;
          const value = data?.stats[card.key] ?? 0;
          return (
            <motion.div
              key={card.key}
              style={{
                padding: "14px 16px",
                background: "var(--bg-surface)",
                border: `1px solid ${value > 0 && (card.key === "overdueFiling" || card.key === "rejectedItems") ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${card.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={13} color={card.color} />
                </div>
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, color: card.color, lineHeight: 1 }}>
                  {dashLoading ? "—" : value}
                </p>
                <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3, fontWeight: 500 }}>
                  {card.label}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Left: Recent Submissions */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
              Recent Submissions
            </h2>
            <Link
              href="/compliance/submissions"
              style={{ fontSize: 12, color: "var(--brand-500)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              View all <ChevronRight size={12} />
            </Link>
          </div>

          {dashLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ height: 76, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : !data?.recentSubmissions.length ? (
            <div style={{ textAlign: "center", padding: "40px 20px", background: "var(--bg-surface)", borderRadius: 14, border: "1px solid var(--border)" }}>
              <ShieldCheck size={28} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
              <p style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>No submissions yet</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                Create your first compliance submission to get started.
              </p>
              <button className="btn-brand" style={{ marginTop: 14 }} onClick={() => setShowForm(true)}>
                <Plus size={14} /> New Submission
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.recentSubmissions.map((sub, i) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ borderColor: "var(--border-strong)" }}
                >
                  <Link
                    href={`/compliance/submissions/${sub.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "14px 16px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      textDecoration: "none",
                      transition: "all 0.2s",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: `${sub.category?.color ?? "#6366f1"}18`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <ShieldCheck size={15} color={sub.category?.color ?? "#6366f1"} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {sub.title}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: sub.category?.color ?? "#6366f1",
                            background: `${sub.category?.color ?? "#6366f1"}18`,
                            padding: "1px 7px",
                            borderRadius: 99,
                            border: `1px solid ${sub.category?.color ?? "#6366f1"}30`,
                          }}
                        >
                          {sub.category?.name ?? sub.categoryId}
                        </span>
                        {sub.dueDate && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: isPast(new Date(sub.dueDate)) ? "#ef4444" : "var(--text-muted)" }}>
                            <Calendar size={10} />
                            {format(new Date(sub.dueDate), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <StatusBadge status={sub.status as ComplianceStatus} size="sm" />
                      <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Expiring Soon */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={13} color="#ef4444" />
                Expiring Soon
              </h3>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: 99 }}>
                {data?.expiringItems.length ?? 0}
              </span>
            </div>
            {data?.expiringItems.length ? (
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {data.expiringItems.slice(0, 5).map((item) => {
                  const daysLeft = item.expiryDate ? differenceInDays(new Date(item.expiryDate), new Date()) : null;
                  return (
                    <Link
                      key={item.id}
                      href={`/compliance/submissions/${item.id}`}
                      style={{ textDecoration: "none" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.title}
                          </p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            {item.expiryDate ? format(new Date(item.expiryDate), "MMM d, yyyy") : "—"}
                          </p>
                        </div>
                        {daysLeft !== null && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: daysLeft <= 7 ? "#ef4444" : "#f59e0b",
                              background: daysLeft <= 7 ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
                              padding: "2px 8px",
                              borderRadius: 99,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {daysLeft}d left
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                No items expiring in the next 30 days
              </div>
            )}
          </div>

          {/* Pending Reminders */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                <Bell size={13} color="#f59e0b" />
                Reminders
              </h3>
              <Link
                href="/compliance/reminders"
                style={{ fontSize: 11, color: "var(--brand-500)", textDecoration: "none" }}
              >
                View all
              </Link>
            </div>
            {data?.pendingReminders.length ? (
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {data.pendingReminders.slice(0, 4).map((r) => (
                  <div key={r.id} style={{ display: "flex", flexDirection: "column" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{r.title}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {format(new Date(r.reminderDate), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                No pending reminders
              </div>
            )}
          </div>

          {/* Category Distribution */}
          {data?.categoryDistribution.length ? (
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                  By Category
                </h3>
              </div>
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {data.categoryDistribution.slice(0, 6).map((cat) => {
                  const total = data.stats.totalSubmissions || 1;
                  const pct = Math.round((cat.count / total) * 100);
                  return (
                    <div key={cat.code}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                          {cat.categoryName}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {cat.count}
                        </span>
                      </div>
                      <div style={{ height: 4, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: cat.color,
                            borderRadius: 99,
                            transition: "width 0.5s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {showForm && (
        <SubmissionFormModal
          categories={categories}
          types={types}
          onClose={() => setShowForm(false)}
          onSubmit={handleCreate}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
