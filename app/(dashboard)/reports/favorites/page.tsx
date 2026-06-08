"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Activity, ExternalLink } from "lucide-react";
import type { ReportDefinition } from "@/lib/reports/types";
import { motion } from "framer-motion";

interface ReportWithFav extends ReportDefinition {
  isFavorite: boolean;
}

export default function FavoritesPage() {
  const [reports, setReports] = useState<ReportWithFav[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => {
        const all: ReportWithFav[] = d.reports ?? [];
        setReports(all.filter((r) => r.isFavorite));
      })
      .finally(() => setLoading(false));
  }, []);

  const removeFav = async (slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    await fetch("/api/reports/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportSlug: slug }),
    });
    setReports((prev) => prev.filter((r) => r.slug !== slug));
  };

  return (
    <div style={{ padding: "24px 32px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
        Favorites
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 24 }}>
        Your starred reports
      </p>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse" style={{ height: 120, borderRadius: 12, background: "var(--bg-muted)" }} />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
          No favorites yet. Star reports from the{" "}
          <Link href="/reports" style={{ color: "var(--accent)" }}>Reports Center</Link>.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {reports.map((r, i) => (
            <motion.div key={r.slug} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link href={`/reports/view/${r.slug}`} style={{ textDecoration: "none" }}>
                <div
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", cursor: "pointer", position: "relative", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                >
                  <button onClick={(e) => removeFav(r.slug, e)} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <Star size={14} fill="var(--warning)" color="var(--warning)" />
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
