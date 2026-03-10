"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Building2, ArrowRight } from "lucide-react";

const businessSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters"),
  type: z.string().min(1, "Please select a business type"),
  industry: z.string().min(1, "Please select an industry"),
  address: z.string().min(5, "Please enter a valid address"),
  country: z.string().min(1, "Please select a country"),
  currency: z.string().min(1, "Please select a currency"),
  taxId: z.string().optional(),
});

type BusinessFormData = z.infer<typeof businessSchema>;

const businessTypes = [
  "Sole Proprietorship",
  "Partnership",
  "Limited Liability Company (LLC)",
  "Corporation",
  "Non-Profit Organization",
  "Cooperative",
  "Franchise",
  "Other",
];

const industries = [
  "Technology & Software",
  "Finance & Banking",
  "Healthcare & Medical",
  "Retail & E-commerce",
  "Manufacturing",
  "Real Estate",
  "Education",
  "Food & Beverage",
  "Consulting & Professional Services",
  "Media & Entertainment",
  "Transportation & Logistics",
  "Construction",
  "Agriculture",
  "Other",
];

const currencies = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "BRL", label: "BRL — Brazilian Real" },
];

const countries = [
  "United States", "United Kingdom", "India", "Canada", "Australia",
  "Germany", "France", "Singapore", "UAE", "Japan", "Brazil",
  "South Africa", "Nigeria", "Kenya", "Pakistan", "Bangladesh",
  "Philippines", "Indonesia", "Malaysia", "Other",
];

export default function BusinessOnboardingForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BusinessFormData>({
    resolver: zodResolver(businessSchema),
    defaultValues: { currency: "USD" },
  });

  const onSubmit = async (data: BusinessFormData) => {
    try {
      setServerError(null);
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create business");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    color: "var(--text-primary)",
    padding: "10px 14px",
    fontSize: 14,
    width: "100%",
    outline: "none",
    transition: "border-color 0.2s ease",
  };

  const labelStyle: React.CSSProperties = {
    color: "var(--text-secondary)",
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    display: "block",
    letterSpacing: "0.02em",
  };

  const errorStyle: React.CSSProperties = {
    color: "#ef4444",
    fontSize: 11,
    marginTop: 4,
    display: "block",
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {serverError && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 10,
            padding: "12px 16px",
            color: "#ef4444",
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          {serverError}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Business Name */}
        <div>
          <label style={labelStyle}>Business Name *</label>
          <input
            {...register("name")}
            placeholder="Acme Corporation"
            style={inputStyle}
          />
          {errors.name && <span style={errorStyle}>{errors.name.message}</span>}
        </div>

        {/* Business Type + Industry */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Business Type *</label>
            <select {...register("type")} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">Select type...</option>
              {businessTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {errors.type && <span style={errorStyle}>{errors.type.message}</span>}
          </div>
          <div>
            <label style={labelStyle}>Industry *</label>
            <select {...register("industry")} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">Select industry...</option>
              {industries.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
            {errors.industry && <span style={errorStyle}>{errors.industry.message}</span>}
          </div>
        </div>

        {/* Address */}
        <div>
          <label style={labelStyle}>Business Address *</label>
          <input
            {...register("address")}
            placeholder="123 Main Street, City, State"
            style={inputStyle}
          />
          {errors.address && <span style={errorStyle}>{errors.address.message}</span>}
        </div>

        {/* Country + Currency */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Country *</label>
            <select {...register("country")} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">Select country...</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.country && <span style={errorStyle}>{errors.country.message}</span>}
          </div>
          <div>
            <label style={labelStyle}>Primary Currency *</label>
            <select {...register("currency")} style={{ ...inputStyle, cursor: "pointer" }}>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            {errors.currency && <span style={errorStyle}>{errors.currency.message}</span>}
          </div>
        </div>

        {/* Tax ID */}
        <div>
          <label style={labelStyle}>Tax ID <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span></label>
          <input
            {...register("taxId")}
            placeholder="e.g. 12-3456789"
            style={inputStyle}
          />
        </div>

        {/* Submit */}
        <motion.button
          type="submit"
          className="btn-brand"
          disabled={isSubmitting}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: "100%",
            justifyContent: "center",
            padding: "12px 24px",
            fontSize: 15,
            fontWeight: 600,
            marginTop: 4,
            borderRadius: 12,
          }}
        >
          {isSubmitting ? (
            "Setting up your workspace..."
          ) : (
            <>
              <Building2 size={16} />
              Create Business Profile
              <ArrowRight size={16} style={{ marginLeft: "auto" }} />
            </>
          )}
        </motion.button>
      </div>
    </form>
  );
}
