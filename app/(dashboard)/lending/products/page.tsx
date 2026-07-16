"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@/lib/queryCache";

const PRODUCT_TYPES = [
  "PERSONAL_LOAN", "BUSINESS_LOAN", "MSME_LOAN", "WORKING_CAPITAL", "INVOICE_FINANCING",
  "SUPPLY_CHAIN_FINANCE", "OVERDRAFT", "LINE_OF_CREDIT", "MERCHANT_CASH_ADVANCE", "EQUIPMENT_LOAN",
];

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

interface LoanProductRow {
  id: string;
  name: string;
  type: string;
  minAmount: string;
  maxAmount: string;
  minTenureMonths: number;
  maxTenureMonths: number;
  minInterestRate: string;
  maxInterestRate: string;
}

export default function LoanProductsPage() {
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ products: LoanProductRow[] }>(["lending", "products"], () => api("/api/lending/products"));

  const [form, setForm] = useState({
    code: "", name: "", type: "BUSINESS_LOAN", minAmount: "", maxAmount: "",
    minTenureMonths: "", maxTenureMonths: "", minInterestRate: "", maxInterestRate: "",
    minCreditScore: "", minMonthlyIncome: "",
  });

  const create = async () => {
    try {
      await api("/api/lending/products", {
        method: "POST",
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          type: form.type,
          minAmount: Number(form.minAmount),
          maxAmount: Number(form.maxAmount),
          minTenureMonths: Number(form.minTenureMonths),
          maxTenureMonths: Number(form.maxTenureMonths),
          minInterestRate: Number(form.minInterestRate),
          maxInterestRate: Number(form.maxInterestRate),
          eligibilityRules: {
            ...(form.minCreditScore ? { minCreditScore: Number(form.minCreditScore) } : {}),
            ...(form.minMonthlyIncome ? { minMonthlyIncome: Number(form.minMonthlyIncome) } : {}),
          },
        }),
      });
      toast.success("Loan product created");
      setShowForm(false);
      qc.invalidate(["lending", "products"]);
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Loan Products</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Product catalog, rates, and eligibility rules</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} style={primaryBtn}><Plus size={15} /> New Product</button>
      </div>

      {showForm && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <input placeholder="Code (e.g. BL-01)" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} style={inputStyle} />
            <input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={inputStyle}>
              {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
            <input placeholder="Min Amount ₹" type="number" value={form.minAmount} onChange={(e) => setForm((f) => ({ ...f, minAmount: e.target.value }))} style={inputStyle} />
            <input placeholder="Max Amount ₹" type="number" value={form.maxAmount} onChange={(e) => setForm((f) => ({ ...f, maxAmount: e.target.value }))} style={inputStyle} />
            <input placeholder="Min Tenure (months)" type="number" value={form.minTenureMonths} onChange={(e) => setForm((f) => ({ ...f, minTenureMonths: e.target.value }))} style={inputStyle} />
            <input placeholder="Max Tenure (months)" type="number" value={form.maxTenureMonths} onChange={(e) => setForm((f) => ({ ...f, maxTenureMonths: e.target.value }))} style={inputStyle} />
            <input placeholder="Min Interest Rate %" type="number" value={form.minInterestRate} onChange={(e) => setForm((f) => ({ ...f, minInterestRate: e.target.value }))} style={inputStyle} />
            <input placeholder="Max Interest Rate %" type="number" value={form.maxInterestRate} onChange={(e) => setForm((f) => ({ ...f, maxInterestRate: e.target.value }))} style={inputStyle} />
            <input placeholder="Min Credit Score (optional)" type="number" value={form.minCreditScore} onChange={(e) => setForm((f) => ({ ...f, minCreditScore: e.target.value }))} style={inputStyle} />
            <input placeholder="Min Monthly Income ₹ (optional)" type="number" value={form.minMonthlyIncome} onChange={(e) => setForm((f) => ({ ...f, minMonthlyIncome: e.target.value }))} style={inputStyle} />
          </div>
          <button onClick={create} style={{ ...primaryBtn, marginTop: 14 }}>Create Product</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {isLoading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}
        {data?.products?.map((p) => (
          <div key={p.id} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>{p.type.replace(/_/g, " ")}</p>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{p.name}</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              ₹{Number(p.minAmount).toLocaleString("en-IN")} – ₹{Number(p.maxAmount).toLocaleString("en-IN")}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.minTenureMonths}–{p.maxTenureMonths} months · {p.minInterestRate}–{p.maxInterestRate}% p.a.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", fontSize: 13, color: "var(--text-primary)" };
const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#6366f1", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" };
