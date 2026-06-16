"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

export default function NotificationBell() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/firm/notifications?unread=1");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCount(data.unread ?? 0);
      } catch {
        /* ignore */
      }
    }
    poll();
    const t = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
    // Re-check whenever the route changes (e.g. after visiting the center).
  }, [pathname]);

  return (
    <Link
      href="/firm/notifications"
      aria-label={`Notifications${count ? ` (${count} unread)` : ""}`}
      style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", position: "relative" }}
    >
      <Bell size={18} />
      {count > 0 && (
        <span
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 99,
            background: "#ef4444",
            color: "white",
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
