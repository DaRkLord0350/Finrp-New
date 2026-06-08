"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Star, Activity, ExternalLink } from "lucide-react";
import type { ReportDefinition } from "@/lib/reports/types";
import { REPORT_CATEGORIES } from "@/lib/reports/registry";

interface ReportWithFav extends ReportDefinition {
  isFavorite: boolean;
}

export default function CategoryPage({ params }: { params: Promise<{ key: string }>; }) {
  const { key } = use(params) ;
  const catMeta = REPORT_CATEGORIES[key];

  const [reports,  setReports]  = useState<ReportWithFav[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {;
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => {
        const all: ReportWithFav[] = d.reports ?? [];
        setReports(all.filter((r) => r.category === key));
      })
      .finally(() => setLoading(false));
  }, [key]);

  const toggleFav = async (slug: string, e: React.MouseEvent) => {
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

  return (
    <div style={{ padding: "24px 32px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
        {catMeta?.label ?? key}
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 24 }}>
        {reports.length} report{reports.length !== 1 ? "s" : ""}
      </p>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse" style={{ height: 120, borderRadius: 12, background: "var(--bg-muted)" }} />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>No reports in this category yet.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {reports.map((r, i) => (
            <motion.div
              key={r.slug}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link href={`/reports/view/${r.slug}`} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    background:  "var(--bg-surface)",
                    border:      "1px solid var(--border)",
                    borderRadius: 12,
                    padding:     "16px 18px",
                    cursor:      "pointer",
                    position:    "relative",
                    transition:  "all 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                >
                  <button
                    onClick={(e) => toggleFav(r.slug, e)}
                    style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", padding: 4 }}
                  >
                    <Star size={14} fill={r.isFavorite ? "var(--warning)" : "none"} color={r.isFavorite ? "var(--warning)" : "var(--text-muted)"} />
                  </button>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Activity size={16} color="var(--accent)" />
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{r.name}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>{r.description}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10, fontSize: 11, color: "var(--accent)", fontWeight: 500 }}>
                    Run Report <ExternalLink size={10} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
