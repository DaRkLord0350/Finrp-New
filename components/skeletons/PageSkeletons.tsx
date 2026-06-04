// Shared skeleton building-blocks used by every loading.tsx file.
// All skeletons are pure CSS — no JS, no framer-motion.

export function SkeletonBlock({
  width = "100%",
  height = 20,
  radius = 6,
  style = {},
}: {
  width?: string | number;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: "var(--bg-elevated, #1a1a2e)",
        animation: "skeletonPulse 1.5s ease-in-out infinite",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

// Stat card skeleton matching the StatCard layout
export function StatCardSkeleton() {
  return (
    <div
      style={{
        padding: "20px 24px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SkeletonBlock width="55%" height={12} />
        <SkeletonBlock width={36} height={36} radius={10} />
      </div>
      <SkeletonBlock width="40%" height={28} />
      <SkeletonBlock width="30%" height={10} />
    </div>
  );
}

// Table row skeleton
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <SkeletonBlock height={14} width={i === 0 ? "80%" : i === cols - 1 ? "60%" : "70%"} />
        </td>
      ))}
    </tr>
  );
}

// Card skeleton for grid layouts
export function CardSkeleton({ height = 180 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        animation: "skeletonPulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

// Chart area skeleton
export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 24,
      }}
    >
      <SkeletonBlock width="40%" height={16} style={{ marginBottom: 8 }} />
      <SkeletonBlock width="60%" height={11} style={{ marginBottom: 24 }} />
      <div
        style={{
          height,
          background: "var(--bg-elevated)",
          borderRadius: 8,
          animation: "skeletonPulse 1.5s ease-in-out infinite",
        }}
      />
    </div>
  );
}

// List-item skeleton for compliance/task lists
export function ListItemSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <SkeletonBlock width={36} height={36} radius={10} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonBlock width="60%" height={13} />
        <SkeletonBlock width="35%" height={10} />
      </div>
      <SkeletonBlock width={64} height={22} radius={99} />
    </div>
  );
}

// Page header skeleton
export function PageHeaderSkeleton({ hasButton = true }: { hasButton?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonBlock width={200} height={28} />
        <SkeletonBlock width={300} height={14} />
      </div>
      {hasButton && (
        <div style={{ display: "flex", gap: 8 }}>
          <SkeletonBlock width={90} height={36} radius={8} />
          <SkeletonBlock width={110} height={36} radius={8} />
        </div>
      )}
    </div>
  );
}

// Keyframes injected once
export function SkeletonStyles() {
  return (
    <style>{`
      @keyframes skeletonPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.45; }
      }
    `}</style>
  );
}
