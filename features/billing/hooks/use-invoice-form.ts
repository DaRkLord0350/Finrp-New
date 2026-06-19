"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { computeInvoiceTotals } from "@/lib/invoices/totals";
import { dueDateFromTerms } from "@/lib/invoices/payment-terms";
import { DEFAULT_APPEARANCE, type InvoiceAppearance } from "@/lib/invoices/appearance-defaults";
import type {
  Customer,
  InventoryItem,
  LineItem,
  TdsTcsSection,
  RecurringConfig,
  StagedAttachment,
  CustomField,
  InvoiceSuccess,
} from "../types";

export interface BusinessProfile {
  businessName?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  gstin?: string | null;
  pan?: string | null;
  websiteUrl?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const newLineItem = (taxPercent = 18): LineItem => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  description: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  unit: "",
  taxPercent,
});

export function useInvoiceForm() {
  // ── Remote data ───────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [sections, setSections] = useState<TdsTcsSection[]>([]);
  const [appearance, setAppearance] = useState<InvoiceAppearance>(DEFAULT_APPEARANCE);
  const [profile, setProfile] = useState<BusinessProfile>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  // ── Header ────────────────────────────────────────────────
  const [customerId, setCustomerId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [paymentTerms, setPaymentTermsState] = useState("NET_30");
  const [dueDate, setDueDate] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [subject, setSubject] = useState("");
  const [currency, setCurrency] = useState("INR");

  // ── Line items ────────────────────────────────────────────
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()]);

  // ── Advanced calculation ──────────────────────────────────
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENT">("PERCENT");
  const [discountValue, setDiscountValue] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [adjustment, setAdjustment] = useState(0);
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [tdsTcsType, setTdsTcsType] = useState<"TDS" | "TCS" | null>(null);
  const [tdsTcsSectionId, setTdsTcsSectionId] = useState("");
  const [tdsTcsRate, setTdsTcsRate] = useState(0);

  // ── Notes / fields ────────────────────────────────────────
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // ── Attachments (staged in memory until the invoice is saved) ──
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);

  // ── Recurring ─────────────────────────────────────────────
  const [recurring, setRecurring] = useState<RecurringConfig>({
    enabled: false,
    frequency: "MONTHLY",
    customIntervalDays: 30,
    startDate: todayISO(),
    endDate: "",
  });

  // ── Submit state ──────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState<InvoiceSuccess | null>(null);

  // ── Load remote data ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      setDataError("");
      try {
        const [custRes, itemsRes, secRes, apprRes, orgRes] = await Promise.all([
          fetch("/api/customers?take=100"),
          fetch("/api/items"),
          fetch("/api/invoices/tds-tcs-sections"),
          fetch("/api/settings/invoice-appearance"),
          fetch("/api/settings/organization"),
        ]);
        if (!custRes.ok) throw new Error("Failed to load customers");
        if (!itemsRes.ok) throw new Error("Failed to load inventory items");

        const custData = await custRes.json();
        const itemsData = await itemsRes.json();
        const secData = await secRes.json().catch(() => ({}));
        const apprData = await apprRes.json().catch(() => ({}));
        const orgData = await orgRes.json().catch(() => ({}));

        if (cancelled) return;
        setCustomers(Array.isArray(custData) ? custData : custData.data ?? custData.customers ?? []);
        setInventoryItems(Array.isArray(itemsData) ? itemsData : itemsData.items ?? []);
        setSections(Array.isArray(secData.sections) ? secData.sections : []);
        if (apprData.appearance) setAppearance(apprData.appearance);
        if (orgData.profile) setProfile(orgData.profile);
      } catch (err) {
        if (!cancelled) setDataError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Auto due date from payment terms ──────────────────────
  const recomputeDueDate = useCallback((term: string, issue: string) => {
    const due = dueDateFromTerms(new Date(issue || todayISO()), term);
    if (due) setDueDate(due.toISOString().slice(0, 10));
  }, []);

  // Initialize / keep due date in sync with the term + issue date.
  useEffect(() => {
    recomputeDueDate(paymentTerms, issueDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPaymentTerms = useCallback(
    (term: string) => {
      setPaymentTermsState(term);
      recomputeDueDate(term, issueDate);
    },
    [issueDate, recomputeDueDate]
  );

  const onIssueDateChange = useCallback(
    (val: string) => {
      setIssueDate(val);
      recomputeDueDate(paymentTerms, val);
    },
    [paymentTerms, recomputeDueDate]
  );

  // ── Line-item helpers ─────────────────────────────────────
  const addLineItem = useCallback(() => setLineItems((prev) => [...prev, newLineItem()]), []);

  const removeLineItem = useCallback(
    (id: string) => setLineItems((prev) => (prev.length === 1 ? prev : prev.filter((i) => i.id !== id))),
    []
  );

  const updateLineItem = useCallback(
    (id: string, updates: Partial<LineItem>) =>
      setLineItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i))),
    []
  );

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
          taxPercent: Number(inv.taxRate) || 0,
        });
      }
    },
    [updateLineItem]
  );

  // Append a fresh row for each selected catalog item (bulk add).
  const bulkAddItems = useCallback((items: InventoryItem[]) => {
    if (items.length === 0) return;
    setLineItems((prev) => {
      const rows = items.map((inv) => ({
        ...newLineItem(Number(inv.taxRate) || 0),
        itemId: inv.id,
        sku: inv.sku ?? undefined,
        description: inv.name,
        unitPrice: Number(inv.sellingPrice),
      }));
      // Drop a leading empty placeholder row if present.
      const base = prev.length === 1 && !prev[0].description && prev[0].unitPrice === 0 ? [] : prev;
      return [...base, ...rows];
    });
  }, []);

  // Create a catalog item inline, then link it to the row.
  const createInlineItem = useCallback(
    async (lineId: string, payload: { name: string; price: number }) => {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: payload.name, price: payload.price, stock: 0, lowStockAt: 1 }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Failed to create item");
      }
      const { item } = await res.json();
      const inv: InventoryItem = {
        id: item.id,
        name: item.name,
        description: item.description ?? null,
        sku: item.sku ?? null,
        sellingPrice: String(item.sellingPrice ?? payload.price),
        taxRate: String(item.taxRate ?? 0),
        stock: Number(item.stock ?? 0),
        isActive: item.isActive ?? true,
      };
      setInventoryItems((prev) => [inv, ...prev]);
      updateLineItem(lineId, {
        itemId: inv.id,
        sku: inv.sku ?? undefined,
        description: inv.name,
        unitPrice: Number(inv.sellingPrice),
      });
      return inv;
    },
    [updateLineItem]
  );

  // ── TDS/TCS helpers ───────────────────────────────────────
  const selectTdsTcsType = useCallback((type: "TDS" | "TCS" | null) => {
    setTdsTcsType(type);
    if (!type) {
      setTdsTcsSectionId("");
      setTdsTcsRate(0);
    }
  }, []);

  const selectTdsTcsSection = useCallback(
    (sectionId: string) => {
      setTdsTcsSectionId(sectionId);
      const sec = sections.find((s) => s.id === sectionId);
      if (sec) setTdsTcsRate(Number(sec.rate));
    },
    [sections]
  );

  // ── Custom fields ─────────────────────────────────────────
  const addCustomField = useCallback(() => setCustomFields((p) => [...p, { label: "", value: "" }]), []);
  const removeCustomField = useCallback((idx: number) => setCustomFields((p) => p.filter((_, i) => i !== idx)), []);
  const setCustomField = useCallback(
    (idx: number, key: "label" | "value", val: string) =>
      setCustomFields((p) => p.map((f, i) => (i === idx ? { ...f, [key]: val } : f))),
    []
  );

  // ── Attachments ───────────────────────────────────────────
  const addAttachments = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    setAttachments((prev) => [
      ...prev,
      ...list.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      })),
    ]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const found = prev.find((a) => a.id === id);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // ── Totals (real-time, single source of truth) ────────────
  const totals = useMemo(
    () =>
      computeInvoiceTotals({
        items: lineItems.map((i) => ({
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount ?? 0,
          taxPercent: i.taxPercent,
        })),
        discountType,
        discountValue,
        shipping,
        adjustment,
        tdsTcsType,
        tdsTcsRate,
        autoRound: roundOffEnabled,
      }),
    [lineItems, discountType, discountValue, shipping, adjustment, tdsTcsType, tdsTcsRate, roundOffEnabled]
  );

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (status: "DRAFT" | "SENT") => {
      setSubmitError("");
      if (!customerId) return setSubmitError("Please select a customer.");
      if (!dueDate) return setSubmitError("Please set a due date.");
      const validItems = lineItems.filter((i) => i.description.trim() && i.unitPrice > 0);
      if (validItems.length === 0)
        return setSubmitError("Add at least one line item with a description and price.");

      setSaving(true);
      try {
        const res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId,
            invoiceNumber: invoiceNumber.trim() || undefined,
            issueDate,
            dueDate,
            paymentTerms,
            salesperson: salesperson.trim() || undefined,
            orderNumber: orderNumber.trim() || undefined,
            referenceNumber: referenceNumber.trim() || undefined,
            subject: subject.trim() || undefined,
            currency,
            discountType,
            discountValue,
            shipping,
            adjustment,
            autoRound: roundOffEnabled,
            tdsTcsType,
            tdsTcsSectionId: tdsTcsSectionId || undefined,
            tdsTcsRate,
            notes: notes.trim() || undefined,
            terms: terms.trim() || undefined,
            internalNotes: internalNotes.trim() || undefined,
            customFields: customFields.filter((f) => f.label.trim()),
            items: validItems.map((i) => ({
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              unit: i.unit || undefined,
              discount: i.discount ?? 0,
              sku: i.sku,
              hsnSac: i.hsnSac,
              taxPercent: i.taxPercent,
            })),
            status,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to create invoice");
        }
        const invoice = await res.json();

        // Upload staged attachments (best-effort; failures are surfaced but don't lose the invoice).
        if (attachments.length > 0) {
          await Promise.allSettled(
            attachments.map((a) => {
              const fd = new FormData();
              fd.append("file", a.file);
              return fetch(`/api/invoices/${invoice.id}/attachments`, { method: "POST", body: fd });
            })
          );
        }

        // Create the recurring schedule if requested.
        if (recurring.enabled) {
          await fetch(`/api/invoices/${invoice.id}/recurring`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              frequency: recurring.frequency,
              customIntervalDays: recurring.frequency === "CUSTOM" ? recurring.customIntervalDays : undefined,
              startDate: recurring.startDate,
              endDate: recurring.endDate || undefined,
            }),
          }).catch(() => {});
        }

        setSuccess({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          pdfUrl: `/api/invoices/${invoice.id}/pdf`,
        });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSaving(false);
      }
    },
    [
      customerId, invoiceNumber, issueDate, dueDate, paymentTerms, salesperson, orderNumber,
      referenceNumber, subject, currency, discountType, discountValue, shipping, adjustment,
      roundOffEnabled, tdsTcsType, tdsTcsSectionId, tdsTcsRate, notes, terms, internalNotes,
      customFields, lineItems, attachments, recurring,
    ]
  );

  const reset = useCallback(() => {
    setSuccess(null);
    setCustomerId("");
    setInvoiceNumber("");
    setIssueDate(todayISO());
    setSalesperson("");
    setOrderNumber("");
    setReferenceNumber("");
    setSubject("");
    setLineItems([newLineItem()]);
    setDiscountValue(0);
    setShipping(0);
    setAdjustment(0);
    selectTdsTcsType(null);
    setNotes("");
    setInternalNotes("");
    setTerms("");
    setCustomFields([]);
    setAttachments([]);
    setRecurring({ enabled: false, frequency: "MONTHLY", customIntervalDays: 30, startDate: todayISO(), endDate: "" });
    setSubmitError("");
    recomputeDueDate(paymentTerms, todayISO());
  }, [paymentTerms, recomputeDueDate, selectTdsTcsType]);

  return {
    // Data
    customers, inventoryItems, sections, appearance, profile, dataLoading, dataError,
    // Header
    customerId, setCustomerId,
    invoiceNumber, setInvoiceNumber,
    issueDate, setIssueDate: onIssueDateChange,
    paymentTerms, setPaymentTerms,
    dueDate, setDueDate,
    salesperson, setSalesperson,
    orderNumber, setOrderNumber,
    referenceNumber, setReferenceNumber,
    subject, setSubject,
    currency, setCurrency,
    // Line items
    lineItems, setLineItems,
    addLineItem, removeLineItem, updateLineItem, handleItemSelect, bulkAddItems, createInlineItem,
    // Calc
    discountType, setDiscountType,
    discountValue, setDiscountValue,
    shipping, setShipping,
    adjustment, setAdjustment,
    roundOffEnabled, setRoundOffEnabled,
    tdsTcsType, selectTdsTcsType,
    tdsTcsSectionId, selectTdsTcsSection,
    tdsTcsRate, setTdsTcsRate,
    // Notes
    notes, setNotes,
    internalNotes, setInternalNotes,
    terms, setTerms,
    customFields, addCustomField, removeCustomField, setCustomField,
    // Attachments
    attachments, addAttachments, removeAttachment,
    // Recurring
    recurring, setRecurring,
    // Totals
    totals,
    // Submit
    saving, submitError, success, handleSubmit, reset,
  };
}

export type InvoiceFormApi = ReturnType<typeof useInvoiceForm>;
