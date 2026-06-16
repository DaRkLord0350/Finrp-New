"use client";

import { useRouter } from "next/navigation";

interface CaOption {
  id: string;
  name: string | null;
  email: string;
}

export function CalendarFilter({
  caUsers,
  currentCaId,
  month,
}: {
  caUsers: CaOption[];
  currentCaId: string;
  month: string;
}) {
  const router = useRouter();

  return (
    <select
      value={currentCaId}
      onChange={(e) => {
        const ca = e.target.value;
        const q = new URLSearchParams({ month });
        if (ca) q.set("caId", ca);
        router.push(`/firm/calendar?${q.toString()}`);
      }}
      style={{
        padding: "8px 12px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        color: "var(--text-primary)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        outline: "none",
      }}
    >
      <option value="">Firm-wide</option>
      {caUsers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name ?? c.email}
        </option>
      ))}
    </select>
  );
}
