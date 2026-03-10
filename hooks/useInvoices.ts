"use client";

import { useEffect, useState } from "react";
import type { Invoice } from "@/types";

export function useInvoices(status?: string) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const query = status ? `?status=${status}` : "";
      const res = await fetch(`/api/invoices${query}`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const data = await res.json();
      setInvoices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [status]);

  const updateStatus = async (id: string, newStatus: string) => {
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) throw new Error("Failed to update invoice");
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id ? { ...inv, status: newStatus as Invoice["status"] } : inv
      )
    );
  };

  const deleteInvoice = async (id: string) => {
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete invoice");
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  };

  const summary = {
    total: invoices.length,
    paid: invoices.filter((i) => i.status === "PAID").length,
    overdue: invoices.filter((i) => i.status === "OVERDUE").length,
    outstanding: invoices
      .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
      .reduce((s, i) => s + Number(i.total), 0),
  };

  return { invoices, loading, error, summary, updateStatus, deleteInvoice, refetch: fetchInvoices };
}
