"use client";

import { useState, useEffect, useCallback } from "react";
import type { Customer, InventoryItem, LineItem, InvoiceSuccess } from "../types";

const DEFAULT_LINE_ITEM: LineItem = {
  id: "1",
  description: "",
  quantity: 1,
  unitPrice: 0,
  taxPercent: 0,
};

export function useInvoiceForm() {
  // ── Remote data ───────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  // ── Form state ────────────────────────────────────────────
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taxRate, setTaxRate] = useState(18);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([DEFAULT_LINE_ITEM]);

  // ── Submit state ──────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState<InvoiceSuccess | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setDataLoading(true);
      setDataError("");
      try {
        const [custRes, itemsRes] = await Promise.all([
          fetch("/api/customers"),
          fetch("/api/items"),
        ]);

        if (!custRes.ok) throw new Error("Failed to load customers");
        if (!itemsRes.ok) throw new Error("Failed to load inventory items");

        const custData = await custRes.json();
        const itemsData = await itemsRes.json();

        if (cancelled) return;
        setCustomers(Array.isArray(custData) ? custData : (custData.data ?? custData.customers ?? []));
        setInventoryItems(Array.isArray(itemsData) ? itemsData : (itemsData.items ?? []));
      } catch (err) {
        if (!cancelled)
          setDataError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Line-item helpers ─────────────────────────────────────
  const addLineItem = useCallback(() => {
    setLineItems((prev) => [
      ...prev,
      { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0, taxPercent: taxRate },
    ]);
  }, [taxRate]);

  const removeLineItem = useCallback((id: string) => {
    setLineItems((prev) => prev.length === 1 ? prev : prev.filter((i) => i.id !== id));
  }, []);

  const updateLineItem = useCallback((id: string, updates: Partial<LineItem>) => {
    setLineItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  }, []);

  const handleItemSelect = useCallback(
    (lineId: string, inv: InventoryItem | null) => {
      if (!inv) {
        updateLineItem(lineId, { itemId: undefined, sku: undefined });
      } else {
        updateLineItem(lineId, {
          itemId: inv.id,
          sku: inv.sku ?? undefined,
          description: inv.name,
          unitPrice: Number(inv.sellingPrice),
          taxPercent: Number(inv.taxRate),
        });
      }
    },
    [updateLineItem]
  );

  // ── Totals ────────────────────────────────────────────────
  const subtotal = lineItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (status: "DRAFT" | "SENT") => {
      setSubmitError("");

      if (!customerId) { setSubmitError("Please select a customer."); return; }
      if (!dueDate) { setSubmitError("Please set a due date."); return; }

      const validItems = lineItems.filter((i) => i.description.trim() && i.unitPrice > 0);
      if (validItems.length === 0) {
        setSubmitError("Add at least one line item with a description and price.");
        return;
      }

      setSaving(true);
      try {
        const res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId, dueDate, taxRate,
            notes: notes.trim() || undefined,
            items: validItems.map((i) => ({
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              sku: i.sku,
              hsnSac: i.hsnSac,
              taxPercent: i.taxPercent,
            })),
            status,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to create invoice");
        }

        const invoice = await res.json();

        // PDF is generated on demand and streamed straight from the API —
        // no pre-generation, no stored file. The link downloads it directly.
        const pdfUrl = `/api/invoices/${invoice.id}/pdf`;

        setSuccess({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, pdfUrl });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSaving(false);
      }
    },
    [customerId, dueDate, taxRate, notes, lineItems]
  );

  const reset = useCallback(() => {
    setSuccess(null);
    setCustomerId("");
    setDueDate("");
    setNotes("");
    setLineItems([DEFAULT_LINE_ITEM]);
    setSubmitError("");
  }, []);

  return {
    // Data
    customers, inventoryItems, dataLoading, dataError,
    // Form
    customerId, setCustomerId,
    dueDate, setDueDate,
    taxRate, setTaxRate,
    notes, setNotes,
    lineItems,
    // Line item actions
    addLineItem, removeLineItem, updateLineItem, handleItemSelect,
    // Totals
    subtotal, taxAmount, total,
    // Submit
    saving, submitError, success,
    handleSubmit, reset,
  };
}
