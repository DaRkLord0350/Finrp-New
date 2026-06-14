"use client";

import { useState } from "react";
import { Download, ChevronDown, FileText, FileSpreadsheet } from "lucide-react";
import type { ReportResult } from "@/lib/reports/types";

interface ReportExporterProps {
  data: ReportResult;
  slug: string;
}

export default function ReportExporter({ data, slug }: ReportExporterProps) {
  const [open, setOpen] = useState(false);

  const exportCSV = () => {
    const headers = data.columns.map((c) => c.label).join(",");
    const rows    = data.rows.map((row) =>
      data.columns
        .map((col) => {
          const val = (row as Record<string, unknown>)[col.key];
          const str = val === null || val === undefined ? "" : String(val);
          return str.includes(",") ? `"${str}"` : str;
        })
        .join(",")
    );
    const csv  = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${slug}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wsData = [
      data.columns.map((c) => c.label),
      ...data.rows.map((row) =>
        data.columns.map((col) => (row as Record<string, unknown>)[col.key] ?? "")
      ),
    ];
    const ws  = XLSX.utils.aoa_to_sheet(wsData);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, data.name.substring(0, 31));
    XLSX.writeFile(wb, `${slug}-${new Date().toISOString().split("T")[0]}.xlsx`);
    setOpen(false);
  };

  const print = () => {
    window.print();
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display:    "flex",
          alignItems: "center",
          gap:        5,
          padding:    "7px 12px",
          borderRadius: 8,
          border:     "1px solid var(--border)",
          background: "var(--bg-surface)",
          cursor:     "pointer",
          fontSize:   12,
          color:      "var(--text-secondary)",
        }}
      >
        <Download size={13} />
        Export
        <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div
            style={{
              position: "fixed",
              inset:    0,
              zIndex:   40,
            }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position:   "absolute",
              right:       0,
              top:         "calc(100% + 4px)",
              background:  "var(--bg-surface)",
              border:      "1px solid var(--border)",
              borderRadius: 10,
              boxShadow:   "0 8px 24px rgba(0,0,0,0.12)",
              minWidth:    160,
              zIndex:      50,
              overflow:    "hidden",
            }}
          >
            {[
              { label: "Export CSV",   icon: FileText,        action: exportCSV   },
              { label: "Export Excel", icon: FileSpreadsheet, action: exportExcel },
              { label: "Print",        icon: Download,        action: print       },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  display:     "flex",
                  alignItems:  "center",
                  gap:         8,
                  width:       "100%",
                  padding:     "10px 14px",
                  background:  "none",
                  border:      "none",
                  cursor:      "pointer",
                  fontSize:    13,
                  color:       "var(--text-primary)",
                  textAlign:   "left",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-muted)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
              >
                <item.icon size={14} color="var(--text-muted)" />
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
