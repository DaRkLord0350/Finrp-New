"use client";

// ============================================================
// Step 2 — Organization Details
// ============================================================

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowRight } from "lucide-react";
import { organizationDetailsSchema, type OrganizationDetailsInput } from "@/validators/onboarding";

interface OrganizationStepProps {
  initialValues: {
    orgName: string;
    businessType: string;
    gstNumber: string;
    currency: string;
    timezone: string;
    logoUrl: string;
    address: string;
  };
  onNext: (data: OrganizationDetailsInput) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

const BUSINESS_TYPES = [
  "Sole Proprietorship",
  "Partnership",
  "Limited Liability Partnership (LLP)",
  "Private Limited Company",
  "Public Limited Company",
  "One Person Company (OPC)",
  "Non-Profit Organization",
  "Cooperative",
  "Trust",
  "Other",
];

const CURRENCIES = [
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "JPY", label: "JPY — Japanese Yen" },
];

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India — IST (UTC+5:30)" },
  { value: "Asia/Dubai", label: "UAE — GST (UTC+4)" },
  { value: "Asia/Singapore", label: "Singapore — SGT (UTC+8)" },
  { value: "America/New_York", label: "US East — EST (UTC-5)" },
  { value: "America/Los_Angeles", label: "US West — PST (UTC-8)" },
  { value: "Europe/London", label: "UK — GMT (UTC+0)" },
  { value: "Europe/Paris", label: "Europe — CET (UTC+1)" },
  { value: "Australia/Sydney", label: "Australia — AEST (UTC+10)" },
  { value: "Asia/Tokyo", label: "Japan — JST (UTC+9)" },
];

const inputStyle: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--text-primary)",
  padding: "10px 14px",
  fontSize: 14,
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
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

export function OrganizationStep({
  initialValues,
  onNext,
  onBack,
  isLoading,
}: OrganizationStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganizationDetailsInput>({
    resolver: zodResolver(organizationDetailsSchema),
    defaultValues: {
      orgName: initialValues.orgName,
      businessType: initialValues.businessType,
      gstNumber: initialValues.gstNumber,
      currency: initialValues.currency || "INR",
      timezone: initialValues.timezone || "Asia/Kolkata",
      logoUrl: initialValues.logoUrl,
      address: initialValues.address,
    },
  });

  return (
    <form onSubmit={handleSubmit(onNext)}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Company Name */}
        <div>
          <label style={labelStyle}>Company Name *</label>
          <input
            {...register("orgName")}
            placeholder="e.g. Acme Private Limited"
            style={inputStyle}
            disabled={isLoading}
          />
          {errors.orgName && <span style={errorStyle}>{errors.orgName.message}</span>}
        </div>

        {/* Business Type */}
        <div>
          <label style={labelStyle}>Business Type *</label>
          <select
            {...register("businessType")}
            style={{ ...inputStyle, cursor: "pointer" }}
            disabled={isLoading}
          >
            <option value="">Select business type...</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {errors.businessType && (
            <span style={errorStyle}>{errors.businessType.message}</span>
          )}
        </div>

        {/* GST + Address */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>
              GST Number{" "}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span>
            </label>
            <input
              {...register("gstNumber")}
              placeholder="e.g. 29ABCDE1234F1Z5"
              style={inputStyle}
              disabled={isLoading}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Business Address{" "}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span>
            </label>
            <input
              {...register("address")}
              placeholder="Street, City, State"
              style={inputStyle}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Currency + Timezone */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Primary Currency *</label>
            <select
              {...register("currency")}
              style={{ ...inputStyle, cursor: "pointer" }}
              disabled={isLoading}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            {errors.currency && <span style={errorStyle}>{errors.currency.message}</span>}
          </div>
          <div>
            <label style={labelStyle}>Timezone *</label>
            <select
              {...register("timezone")}
              style={{ ...inputStyle, cursor: "pointer" }}
              disabled={isLoading}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            {errors.timezone && (
              <span style={errorStyle}>{errors.timezone.message}</span>
            )}
          </div>
        </div>

        {/* Logo URL */}
        <div>
          <label style={labelStyle}>
            Logo URL{" "}
            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span>
          </label>
          <input
            {...register("logoUrl")}
            placeholder="https://yourcompany.com/logo.png"
            style={inputStyle}
            disabled={isLoading}
          />
          {errors.logoUrl && <span style={errorStyle}>{errors.logoUrl.message}</span>}
          <span
            style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "block" }}
          >
            You can also upload a logo from Settings after setup.
          </span>
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            style={{
              flex: "0 0 auto",
              padding: "11px 20px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--text-secondary)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isLoading}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "11px 20px",
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              border: "none",
              borderRadius: 10,
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.75 : 1,
            }}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            {isLoading ? "Saving..." : "Continue"}
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </form>
  );
}
