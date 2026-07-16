"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";

interface Product {
  id: string;
  name: string;
  type: string;
  minAmount: string;
  maxAmount: string;
  minTenureMonths: number;
  maxTenureMonths: number;
}
interface Customer {
  id: string;
  name: string;
  email?: string;
}

const STEPS = ["Loan Details", "Co-Applicants", "Financial Profile", "Review"];

export default function NewLoanApplicationPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [form, setForm] = useState({
    customerId: "",
    customerName: "",
    productId: "",
    requestedAmount: "",
    requestedTenureMonths: "",
    purpose: "",
  });
  const [coApplicants, setCoApplicants] = useState<{ role: "CO_APPLICANT" | "GUARANTOR"; name: string; email: string; phone: string }[]>([]);
  const [profile, setProfile] = useState({ monthlyIncome: "", creditScore: "", businessVintageMonths: "", applicantAge: "" });

  useEffect(() => {
    fetch("/api/lending/products?activeOnly=true")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .catch(() => toast.error("Could not load loan products"));
  }, []);

  useEffect(() => {
    if (customerQuery.length < 2) return;
    const t = setTimeout(() => {
      fetch(`/api/customers?q=${encodeURIComponent(customerQuery)}&take=10`)
        .then((r) => r.json())
        .then((d) => setCustomers(d.items ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [customerQuery]);

  const selectedProduct = products.find((p) => p.id === form.productId);

  const canProceedStep0 = form.customerId && form.productId && Number(form.requestedAmount) > 0 && Number(form.requestedTenureMonths) > 0;

  const addCoApplicant = () => setCoApplicants((c) => [...c, { role: "CO_APPLICANT", name: "", email: "", phone: "" }]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const createRes = await fetch("/api/lending/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId,
          productId: form.productId,
          requestedAmount: Number(form.requestedAmount),
          requestedTenureMonths: Number(form.requestedTenureMonths),
          purpose: form.purpose || undefined,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error ?? "Could not create application");
      const applicationId = created.application.id;

      for (const co of coApplicants) {
        if (!co.name) continue;
        await fetch(`/api/lending/applications/${applicationId}/co-applicants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(co),
        });
      }

      const submitRes = await fetch(`/api/lending/applications/${applicationId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            monthlyIncome: profile.monthlyIncome ? Number(profile.monthlyIncome) : undefined,
            creditScore: profile.creditScore ? Number(profile.creditScore) : undefined,
            businessVintageMonths: profile.businessVintageMonths ? Number(profile.businessVintageMonths) : undefined,
            applicantAge: profile.applicantAge ? Number(profile.applicantAge) : undefined,
          },
        }),
      });
      const submitted = await submitRes.json();
      if (!submitRes.ok) throw new Error(submitted.error ?? "Could not submit application");

      toast.success(`Application ${created.application.applicationNumber} submitted`);
      router.push(`/lending/applications/${applicationId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>New Loan Application</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>

      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= step ? "#6366f1" : "var(--border)" }} />
        ))}
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24 }}>
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block" }}>Customer</label>
              <input
                value={form.customerName || customerQuery}
                onChange={(e) => { setCustomerQuery(e.target.value); setForm((f) => ({ ...f, customerId: "", customerName: "" })); }}
                placeholder="Search customer by name…"
                style={inputStyle}
              />
              {customers.length > 0 && !form.customerId && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, marginTop: 4, maxHeight: 160, overflowY: "auto" }}>
                  {customers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => { setForm((f) => ({ ...f, customerId: c.id, customerName: c.name })); setCustomers([]); }}
                      style={{ padding: "8px 10px", fontSize: 13, cursor: "pointer" }}
                    >
                      {c.name} {c.email && <span style={{ color: "var(--text-muted)" }}>· {c.email}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block" }}>Loan Product</label>
              <select value={form.productId} onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} style={inputStyle}>
                <option value="">Select a product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.type.replace(/_/g, " ")})</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block" }}>
                  Requested Amount (₹){selectedProduct && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> — {selectedProduct.minAmount} to {selectedProduct.maxAmount}</span>}
                </label>
                <input type="number" value={form.requestedAmount} onChange={(e) => setForm((f) => ({ ...f, requestedAmount: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block" }}>
                  Tenure (months){selectedProduct && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> — {selectedProduct.minTenureMonths} to {selectedProduct.maxTenureMonths}</span>}
                </label>
                <input type="number" value={form.requestedTenureMonths} onChange={(e) => setForm((f) => ({ ...f, requestedTenureMonths: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block" }}>Purpose (optional)</label>
              <input value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} style={inputStyle} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Add co-applicants or guarantors if applicable — optional.</p>
            {coApplicants.map((co, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                <select value={co.role} onChange={(e) => setCoApplicants((list) => list.map((c, j) => j === i ? { ...c, role: e.target.value as "CO_APPLICANT" | "GUARANTOR" } : c))} style={inputStyle}>
                  <option value="CO_APPLICANT">Co-Applicant</option>
                  <option value="GUARANTOR">Guarantor</option>
                </select>
                <input placeholder="Name" value={co.name} onChange={(e) => setCoApplicants((list) => list.map((c, j) => j === i ? { ...c, name: e.target.value } : c))} style={inputStyle} />
                <input placeholder="Email" value={co.email} onChange={(e) => setCoApplicants((list) => list.map((c, j) => j === i ? { ...c, email: e.target.value } : c))} style={inputStyle} />
                <input placeholder="Phone" value={co.phone} onChange={(e) => setCoApplicants((list) => list.map((c, j) => j === i ? { ...c, phone: e.target.value } : c))} style={inputStyle} />
              </div>
            ))}
            <button onClick={addCoApplicant} style={{ ...secondaryBtnStyle, marginTop: 4 }}>+ Add Co-Applicant / Guarantor</button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block" }}>Monthly Income (₹)</label>
              <input type="number" value={profile.monthlyIncome} onChange={(e) => setProfile((p) => ({ ...p, monthlyIncome: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block" }}>Credit Score (if known)</label>
              <input type="number" value={profile.creditScore} onChange={(e) => setProfile((p) => ({ ...p, creditScore: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block" }}>Business Vintage (months)</label>
              <input type="number" value={profile.businessVintageMonths} onChange={(e) => setProfile((p) => ({ ...p, businessVintageMonths: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "block" }}>Applicant Age</label>
              <input type="number" value={profile.applicantAge} onChange={(e) => setProfile((p) => ({ ...p, applicantAge: e.target.value }))} style={inputStyle} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 10 }}>
            <ReviewRow label="Customer" value={form.customerName} />
            <ReviewRow label="Product" value={selectedProduct?.name ?? "—"} />
            <ReviewRow label="Amount" value={`₹${form.requestedAmount}`} />
            <ReviewRow label="Tenure" value={`${form.requestedTenureMonths} months`} />
            <ReviewRow label="Co-Applicants" value={coApplicants.filter((c) => c.name).length.toString()} />
            <ReviewRow label="Monthly Income" value={profile.monthlyIncome ? `₹${profile.monthlyIncome}` : "Not provided"} />
            <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
              Submitting will run the eligibility pre-screen and move the application into Document Collection.
            </p>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button disabled={step === 0} onClick={() => setStep((s) => s - 1)} style={{ ...secondaryBtnStyle, opacity: step === 0 ? 0.4 : 1 }}>
          <ChevronLeft size={14} /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button disabled={step === 0 && !canProceedStep0} onClick={() => setStep((s) => s + 1)} style={{ ...primaryBtnStyle, opacity: step === 0 && !canProceedStep0 ? 0.5 : 1 }}>
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button disabled={submitting} onClick={handleSubmit} style={primaryBtnStyle}>
            {submitting ? "Submitting…" : <>Submit Application <Check size={14} /></>}
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg-base)", fontSize: 13, color: "var(--text-primary)",
};
const primaryBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: "#6366f1",
  color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
};
const secondaryBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "var(--bg-surface)",
  border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", cursor: "pointer",
};
