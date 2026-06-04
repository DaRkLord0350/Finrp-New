import {
  SkeletonBlock,
  StatCardSkeleton,
  TableRowSkeleton,
  ChartSkeleton,
  ListItemSkeleton,
  SkeletonStyles,
} from "@/components/skeletons/PageSkeletons";

export default function DashboardLoading() {
  return (
    <div>
      <SkeletonStyles />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SkeletonBlock width={220} height={28} />
          <SkeletonBlock width={300} height={14} />
        </div>
        <SkeletonBlock width={80} height={34} radius={8} />
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>

      {/* Chart + Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, marginBottom: 24 }}>
        <ChartSkeleton height={220} />
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <SkeletonBlock width="50%" height={16} style={{ marginBottom: 6 }} />
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10 }}>
              <SkeletonBlock width={34} height={34} radius={8} />
              <SkeletonBlock width="55%" height={13} />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* Recent Invoices */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
            <SkeletonBlock width={130} height={16} />
            <SkeletonBlock width={60} height={13} />
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Invoice", "Customer", "Amount", "Status", "Date"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left" }}>
                    <SkeletonBlock width={h.length * 7} height={11} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(4)].map((_, i) => <TableRowSkeleton key={i} cols={5} />)}
            </tbody>
          </table>
        </div>

        {/* Compliance */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "20px 20px 16px", borderBottom: "1px solid var(--border)" }}>
            <SkeletonBlock width={100} height={16} />
            <SkeletonBlock width={60} height={13} />
          </div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {[...Array(3)].map((_, i) => <ListItemSkeleton key={i} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
