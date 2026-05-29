"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Plus,
  RefreshCw,
  Search,
  ChevronRight,
  ShieldCheck,
  Calendar,
  ChevronLeft,
  Filter,
  X,
} from "lucide-react";
import { useComplianceSubmissions } from "@/hooks/useComplianceSubmissions";
import { useComplianceCategories, useComplianceTypes } from "@/hooks/useComplianceCategories";
import StatusBadge from "@/components/compliance/StatusBadge";
import SubmissionFormModal from "@/components/compliance/SubmissionFormModal";
import type { ComplianceStatus } from "@/types/compliance";
import { format, isPast } from "date-fns";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "EXPIRED", label: "Expired" },
  { value: "PENDING_RENEWAL", label: "Pending Renewal" },
];

export default function SubmissionsPage() {
  const { categories } = useComplianceCategories();
  const { types } = useComplianceTypes();
  const {
    submissions,
    pagination,
    loading,
    error,
    params,
    updateParams,
    refetch,
    createSubmission,
    deleteSubmission,
  } = useComplianceSubmissions({ pageSize: 20, sortBy: "createdAt", sortOrder: "desc" });

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSearch = () => updateParams({ search: search || undefined });
  const handleDelete = async (id: string) => {
    if (!confirm("Archive this compliance submission?")) return;
    setDeletingId(id);
    try {
      await deleteSubmission(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async (input: Parameters<typeof createSubmission>[0]) => {
    await createSubmission(input);
    setShowForm(false);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link
              href="/compliance"
              style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              Compliance
            </Link>
            <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>Submissions</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
            All Submissions
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>
            {pagination.total} total compliance submission{pagination.total !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={() => refetch()} style={{ padding: "8px 12px" }}>
            <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
          <button className="btn-brand" onClick={() => setShowForm(true)}>
            <Plus size={14} /> New Submission
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 20,
          flexWrap: "wrap",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "12px 16px",
        }}
      >
        <Filter size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ color: "var(--text-muted)" }} />
          <input
            style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text-primary)", width: "100%" }}
            placeholder="Search by title, reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          {search && (
            <button
              onClick={() => { setSearch(""); updateParams({ search: undefined }); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: "var(--border)" }} />

        {/* Status */}
        <select
          className="input"
          value={params.status ?? ""}
          onChange={(e) =>
            updateParams({ status: e.target.value ? (e.target.value as ComplianceStatus) : undefined })
          }
          style={{ padding: "6px 10px", fontSize: 12, minWidth: 140 }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Category */}
        <select
          className="input"
          value={params.categoryId ?? ""}
          onChange={(e) => updateParams({ categoryId: e.target.value || undefined })}
          style={{ padding: "6px 10px", fontSize: 12, minWidth: 140 }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          className="input"
          value={`${params.sortBy ?? "createdAt"}:${params.sortOrder ?? "desc"}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split(":") as [typeof params.sortBy, typeof params.sortOrder];
            updateParams({ sortBy, sortOrder });
          }}
          style={{ padding: "6px 10px", fontSize: 12, minWidth: 140 }}
        >
          <option value="createdAt:desc">Newest First</option>
          <option value="createdAt:asc">Oldest First</option>
          <option value="dueDate:asc">Due Date ↑</option>
          <option value="dueDate:desc">Due Date ↓</option>
          <option value="expiryDate:asc">Expiry ↑</option>
          <option value="title:asc">Title A→Z</option>
        </select>

        <button className="btn-brand" onClick={handleSearch} style={{ padding: "7px 14px", fontSize: 12 }}>
          Search
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.5fr 1fr 1fr 1fr 80px",
            gap: 8,
            padding: "10px 16px",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border)",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          <span>Title / Category</span>
          <span>Status</span>
          <span>Due Date</span>
          <span>Expiry</span>
          <span style={{ textAlign: "right" }}>Docs</span>
        </div>

        {loading ? (
          <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ height: 52, background: "var(--bg-elevated)", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <ShieldCheck size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>
              No submissions found
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              {params.status || params.categoryId || params.search
                ? "Try adjusting your filters"
                : "Create your first compliance submission"}
            </p>
          </div>
        ) : (
          submissions.map((sub, i) => {
            const overdue =
              sub.dueDate &&
              isPast(new Date(sub.dueDate)) &&
              !["APPROVED", "REJECTED", "EXPIRED"].includes(sub.status);
            const expiryWarning =
              sub.expiryDate &&
              !isPast(new Date(sub.expiryDate)) &&
              (new Date(sub.expiryDate).getTime() - Date.now()) / 86400000 <= 30;

            return (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2.5fr 1fr 1fr 1fr 80px",
                  gap: 8,
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border)",
                  alignItems: "center",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Title */}
                <div style={{ minWidth: 0 }}>
                  <Link
                    href={`/compliance/submissions/${sub.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
                      {sub.title}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {sub.category && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: sub.category.color,
                            background: `${sub.category.color}18`,
                            border: `1px solid ${sub.category.color}30`,
                            padding: "1px 6px",
                            borderRadius: 99,
                          }}
                        >
                          {sub.category.name}
                        </span>
                      )}
                      {sub.referenceNumber && (
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          #{sub.referenceNumber}
                        </span>
                      )}
                    </div>
                  </Link>
                </div>

                {/* Status */}
                <div>
                  <StatusBadge status={sub.status as ComplianceStatus} size="sm" />
                </div>

                {/* Due Date */}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {sub.dueDate ? (
                    <span
                      style={{
                        fontSize: 12,
                        color: overdue ? "#ef4444" : "var(--text-secondary)",
                        fontWeight: overdue ? 600 : 400,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Calendar size={11} />
                      {format(new Date(sub.dueDate), "MMM d, yyyy")}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                  )}
                </div>

                {/* Expiry */}
                <div>
                  {sub.expiryDate ? (
                    <span
                      style={{
                        fontSize: 12,
                        color: expiryWarning ? "#f59e0b" : "var(--text-secondary)",
                        fontWeight: expiryWarning ? 600 : 400,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Calendar size={11} />
                      {format(new Date(sub.expiryDate), "MMM d, yyyy")}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                  )}
                </div>

                {/* Doc count + Actions */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                  {(sub._count?.documents ?? 0) > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#6366f1",
                        background: "rgba(99,102,241,0.12)",
                        border: "1px solid rgba(99,102,241,0.3)",
                        padding: "1px 6px",
                        borderRadius: 99,
                      }}
                    >
                      {sub._count!.documents}
                    </span>
                  )}
                  <Link
                    href={`/compliance/submissions/${sub.id}`}
                    style={{ color: "var(--text-muted)", display: "flex" }}
                  >
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, padding: "0 4px" }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Showing {((pagination.page - 1) * pagination.pageSize) + 1}–
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="btn-ghost"
              disabled={pagination.page <= 1}
              onClick={() => updateParams({ page: pagination.page - 1 })}
              style={{ padding: "6px 10px" }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ display: "flex", alignItems: "center", padding: "6px 12px", fontSize: 13, color: "var(--text-secondary)" }}>
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              className="btn-ghost"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateParams({ page: pagination.page + 1 })}
              style={{ padding: "6px 10px" }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

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
