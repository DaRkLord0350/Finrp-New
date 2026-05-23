// ============================================================
// components/ui/SearchBar.tsx
// Global search bar with debounce.
// ============================================================
"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  className?: string;
}

export function SearchBar({
  placeholder = "Search…",
  value: externalValue,
  onChange,
  debounceMs = 300,
  className = "",
}: SearchBarProps) {
  const [internal, setInternal] = useState(externalValue ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep in sync if parent controls value
  useEffect(() => {
    if (externalValue !== undefined) setInternal(externalValue);
  }, [externalValue]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInternal(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(val), debounceMs);
  }

  function clear() {
    setInternal("");
    onChange("");
  }

  return (
    <div
      className={`relative flex items-center ${className}`}
      style={{ minWidth: 200 }}
    >
      <Search
        size={15}
        className="absolute left-3 text-[var(--text-muted)] pointer-events-none"
      />
      <input
        type="text"
        value={internal}
        onChange={handleChange}
        placeholder={placeholder}
        style={{
          width: "100%",
          paddingLeft: 34,
          paddingRight: internal ? 34 : 12,
          paddingTop: 8,
          paddingBottom: 8,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          color: "var(--text-primary)",
          fontSize: 14,
          outline: "none",
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      />
      {internal && (
        <button
          onClick={clear}
          style={{
            position: "absolute",
            right: 10,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
