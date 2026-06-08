"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search, Star, TrendingUp, Droplets, ShoppingCart, Users, Package,
  Clock, Wallet, Receipt, AlertCircle, Building2, Scale, BookOpen, Activity,
  ExternalLink,
} from "lucide-react";
import type { ReportDefinition } from "@/lib/reports/types";
import { REPORT_CATEGORIES } from "@/lib/reports/registry";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  TrendingUp, Droplets, ShoppingCart, Users, Package, Clock, Wallet, Receipt,
  AlertCircle, Building2, Scale, BookOpen, Activity, Star,
};

interface ReportWithFav extends ReportDefinition {
  isFavorite: boolean;
}

export default function ReportsHomeClient() {
  const [reports,   setReports]   = useState<ReportWithFav[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [query,     setQuery]     = useState("");
  const [toggling,  setToggling]  = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => setReports(d.reports ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return reports;
    const q = query.toLowerCase();
    return reports.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
    );
  }, [reports, query]);

  const byCategory = useMemo(() => {
    const map = new Map<string, ReportWithFav[]>();
    for (const r of filtered) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return map;
  }, [filtered]);

  const toggleFavorite = async (slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (toggling) return;
    setToggling(slug);
    try {
      const res = await fetch("/api/reports/favorites", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reportSlug: slug }),
      });
      const { favorited } = await res.json();
      setReports((prev) =>
        prev.map((r) => (r.slug === slug ? { ...r, isFavorite: favorited } : r))
      );
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="animate-pulse" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: 120, borderRadius: 12, background: "var(--bg-muted)" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          Reports Center
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          Analyze your business data across all modules
        </p>
      </div>

      {/* Search */}
      <div
        style={{
          display:       "flex",
          alignItems:    "center",
          gap:           10,
          background:    "var(--bg-surface)",
          border:        "1px solid var(--border)",
          borderRadius:  10,
          padding:       "0 14px",
          marginBottom:  28,
          maxWidth:      420,
        }}
      >
        <Search size={16} color="var(--text-muted)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reports…"
          style={{
            flex:        1,
            border:      "none",
            background:  "transparent",
            outline:     "none",
            padding:     "11px 0",
            fontSize:    14,
            color:       "var(--text-primary)",
          }}
        />
      </div>

      {/* Category sections */}
      {byCategory.size === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No reports found.</p>
      )}

      {Array.from(byCategory.entries()).map(([catKey, catReports], ci) => {
        const catMeta = REPORT_CATEGORIES[catKey];
        return (
          <motion.section
            key={catKey}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: ci * 0.04 }}
            style={{ marginBottom: 36 }}
          >
            <div
              style={{
                display:       "flex",
                alignItems:    "center",
                justifyContent: "space-between",
                marginBottom:  14,
              }}
            >
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                {catMeta?.label ?? catKey}
              </h2>
              <Link
                href={`/reports/category/${catKey}`}
                style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}
              >
                View all
              </Link>
            </div>

            <div
              style={{
                display:             "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap:                 12,
              }}
            >
              {catReports.map((report) => (
                <ReportCard
                  key={report.slug}
                  report={report}
                  onToggleFav={toggleFavorite}
                  toggling={toggling}
                />
              ))}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}

function ReportCard({
  report,
  onToggleFav,
  toggling,
}: {
  report: ReportWithFav;
  onToggleFav: (slug: string, e: React.MouseEvent) => void;
  toggling: string | null;
}) {
  const Icon = ICON_MAP[report.icon] ?? Activity;

  return (
    <Link
      href={`/reports/view/${report.slug}`}
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          background:    "var(--bg-surface)",
          border:        "1px solid var(--border)",
          borderRadius:  12,
          padding:       "16px 18px",
          cursor:        "pointer",
          transition:    "all 0.15s",
          position:      "relative",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
          (e.currentTarget as HTMLElement).style.boxShadow   = "0 2px 12px rgba(99,102,241,0.12)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLElement).style.boxShadow   = "none";
        }}
      >
        {/* Favorite button */}
        <button
          onClick={(e) => onToggleFav(report.slug, e)}
          disabled={toggling === report.slug}
          style={{
            position:   "absolute",
            top:        12,
            right:      12,
            background: "none",
            border:     "none",
            cursor:     "pointer",
            padding:    4,
            opacity:    toggling === report.slug ? 0.5 : 1,
          }}
        >
          <Star
            size={14}
            fill={report.isFavorite ? "var(--warning)" : "none"}
            color={report.isFavorite ? "var(--warning)" : "var(--text-muted)"}
          />
        </button>

        {/* Icon + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div
            style={{
              width:        32,
              height:       32,
              borderRadius: 8,
              background:   "var(--accent-subtle)",
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              flexShrink:   0,
            }}
          >
            <Icon size={16} color="var(--accent)" />
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
            {report.name}
          </span>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
          {report.description}
        </p>

        <div
          style={{
            display:    "flex",
            alignItems: "center",
            gap:        4,
            marginTop:  10,
            fontSize:   11,
            color:      "var(--accent)",
            fontWeight: 500,
          }}
        >
          Run Report <ExternalLink size={10} />
        </div>
      </div>
    </Link>
  );
}
