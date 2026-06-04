import {
  SkeletonBlock,
  TableRowSkeleton,
  PageHeaderSkeleton,
  SkeletonStyles,
} from "@/components/skeletons/PageSkeletons";

export default function BillingLoading() {
  return (
    <div>
      <SkeletonStyles />
      <PageHeaderSkeleton />

      {/* Summary strips */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ padding: "16px 18px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
            <SkeletonBlock width="55%" height={11} style={{ marginBottom: 10 }} />
            <SkeletonBlock width="40%" height={24} />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <SkeletonBlock width={320} height={38} radius={10} />
        <div style={{ display: "flex", gap: 6 }}>
          {[...Array(5)].map((_, i) => <SkeletonBlock key={i} width={70} height={32} radius={8} />)}
        </div>
      </div>

      {/* Invoice table */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Invoice #", "Customer", "Amount", "Status", "Issue Date", "Due Date", ""].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left" }}>
                  {h && <SkeletonBlock width={h.length * 7} height={11} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(8)].map((_, i) => <TableRowSkeleton key={i} cols={7} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
