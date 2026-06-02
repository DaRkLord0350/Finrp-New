import {
  SkeletonBlock,
  StatCardSkeleton,
  TableRowSkeleton,
  SkeletonStyles,
} from "@/components/skeletons/PageSkeletons";

export default function CustomerDetailLoading() {
  return (
    <div>
      <SkeletonStyles />
      {/* Back link + title */}
      <div style={{ marginBottom: 24 }}>
        <SkeletonBlock width={80} height={13} style={{ marginBottom: 16 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <SkeletonBlock width={56} height={56} radius={14} />
          <div>
            <SkeletonBlock width={200} height={24} style={{ marginBottom: 8 }} />
            <SkeletonBlock width={150} height={13} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>

      {/* Invoice table */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
          <SkeletonBlock width={120} height={16} />
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {[...Array(5)].map((_, i) => <TableRowSkeleton key={i} cols={5} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
