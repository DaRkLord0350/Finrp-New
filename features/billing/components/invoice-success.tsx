"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import type { InvoiceSuccess } from "../types";

interface Props {
  success: InvoiceSuccess;
  onNewInvoice: () => void;
}

export function InvoiceSuccessScreen({ success, onNewInvoice }: Props) {
  const router = useRouter();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 20 }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
        style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <CheckCircle2 size={32} color="#22c55e" />
      </motion.div>

      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          Invoice Created
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          {success.invoiceNumber} has been saved successfully.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {success.pdfUrl && (
          <a href={success.pdfUrl} target="_blank" rel="noreferrer" className="btn-brand" style={{ gap: 7 }}>
            <Download size={14} /> Download PDF
          </a>
        )}
        <button onClick={() => router.push("/billing")} className="btn-ghost">
          View all invoices
        </button>
        <button onClick={onNewInvoice} className="btn-ghost">
          New invoice
        </button>
      </div>
    </div>
  );
}
