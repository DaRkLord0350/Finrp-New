"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  ACCOUNT_TYPES,
  ACCOUNT_SUBTYPES,
} from "@/lib/validators/chart-of-accounts";
import type {
  ChartAccount,
  AccountOption,
  AccountType,
  CreateAccountInput,
  UpdateAccountInput,
} from "@/hooks/useChartOfAccounts";

interface AccountFormModalProps {
  account: ChartAccount | null;
  parentOptions: AccountOption[];
  onClose: () => void;
  onCreate: (input: CreateAccountInput) => Promise<unknown>;
  onUpdate: (id: string, input: UpdateAccountInput) => Promise<unknown>;
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  padding: "9px 12px",
  fontSize: 14,
  width: "100%",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 500,
  marginBottom: 6,
  display: "block",
};

const errorStyle: React.CSSProperties = {
  color: "#ef4444",
  fontSize: 11,
  marginTop: 4,
  display: "block",
};

export function AccountFormModal({ account, parentOptions, onClose, onCreate, onUpdate }: AccountFormModalProps) {
  const isEdit = !!account;

  const [code, setCode] = useState(account?.code ?? "");
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "ASSET");
  const [subType, setSubType] = useState(account?.accountSubType ?? "");
  const [parentAccountId, setParentAccountId] = useState(account?.parentAccountId ?? "");
  const [openingBalance, setOpeningBalance] = useState(String(account?.openingBalance ?? "0"));
  const [description, setDescription] = useState(account?.description ?? "");
  const [isActive, setIsActive] = useState(account?.isActive ?? true);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCode(account?.code ?? "");
    setName(account?.name ?? "");
    setType(account?.type ?? "ASSET");
    setSubType(account?.accountSubType ?? "");
    setParentAccountId(account?.parentAccountId ?? "");
    setOpeningBalance(String(account?.openingBalance ?? "0"));
    setDescription(account?.description ?? "");
    setIsActive(account?.isActive ?? true);
  }, [account]);

  const subTypeOptions = useMemo(() => ACCOUNT_SUBTYPES[type] ?? [], [type]);

  const eligibleParents = useMemo(
    () => parentOptions.filter((p) => p.type === type && p.id !== account?.id),
    [parentOptions, type, account?.id]
  );

  const handleTypeChange = (next: AccountType) => {
    setType(next);
    setSubType("");
    setParentAccountId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEdit && !code.trim()) { setError("Account code is required"); return; }
    if (!name.trim()) { setError("Account name is required"); return; }

    setSubmitting(true);
    try {
      if (isEdit && account) {
        await onUpdate(account.id, {
          accountName: name.trim(),
          description: description.trim() || null,
          parentAccountId: parentAccountId || null,
          isActive,
          ...(account.isSystemGenerated ? {} : { accountType: type, accountSubType: subType || null }),
        });
      } else {
        const payload: CreateAccountInput = {
          accountCode: code.trim(),
          accountName: name.trim(),
          accountType: type,
          accountSubType: subType || null,
          parentAccountId: parentAccountId || null,
          description: description.trim() || null,
          openingBalance: Number(openingBalance) || 0,
        };
        await onCreate(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
              {isEdit ? "Edit Account" : "Add New Account"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              {isEdit ? "Update account details" : "Create a new ledger account in your chart of accounts"}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {isEdit && account?.isSystemGenerated && (
          <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 8, padding: "10px 14px", color: "var(--text-secondary)", fontSize: 12, marginBottom: 16 }}>
            This is a system-generated account. Its code, type and subtype are locked, but you can rename it, change its parent, description or active status.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Account Code *</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 1050"
                disabled={isEdit}
                style={{ ...inputStyle, opacity: isEdit ? 0.6 : 1 }}
              />
            </div>
            <div>
              <label style={labelStyle}>Account Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Petty Cash"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Account Type *</label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as AccountType)}
                disabled={isEdit && account?.isSystemGenerated}
                style={{ ...inputStyle, cursor: "pointer", opacity: isEdit && account?.isSystemGenerated ? 0.6 : 1 }}
              >
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Account Subtype</label>
              <select
                value={subType}
                onChange={(e) => setSubType(e.target.value)}
                disabled={isEdit && account?.isSystemGenerated}
                style={{ ...inputStyle, cursor: "pointer", opacity: isEdit && account?.isSystemGenerated ? 0.6 : 1 }}
              >
                <option value="">— None —</option>
                {subTypeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isEdit ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Parent Account</label>
              <select
                value={parentAccountId}
                onChange={(e) => setParentAccountId(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">— No parent (top-level) —</option>
                {eligibleParents.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
            {!isEdit && (
              <div>
                <label style={labelStyle}>Opening Balance</label>
                <input
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  style={inputStyle}
                />
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this account..."
              rows={2}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          {isEdit && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", cursor: account?.isSystemGenerated ? "default" : "pointer" }}>
              <input
                type="checkbox"
                checked={isActive}
                disabled={account?.isSystemGenerated && account.isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Account is active
            </label>
          )}

          {error && <span style={errorStyle}>{error}</span>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: "9px 18px" }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-brand" style={{ padding: "9px 18px", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
