import {
  StatCardSkeleton,
  ChartSkeleton,
  PageHeaderSkeleton,
  SkeletonBlock,
  SkeletonStyles,
} from "@/components/skeletons/PageSkeletons";

export default function FinanceLoading() {
  return (
    <div>
      <SkeletonStyles />
      <PageHeaderSkeleton />

      {/* KPI stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>

      {/* Charts row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        <ChartSkeleton height={220} />
        <ChartSkeleton height={220} />
      </div>

      {/* Charts row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <ChartSkeleton height={180} />
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
          <SkeletonBlock width="40%" height={16} style={{ marginBottom: 8 }} />
          <SkeletonBlock width="60%" height={11} style={{ marginBottom: 24 }} />
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <SkeletonBlock width="45%" height={13} />
                <SkeletonBlock width="20%" height={13} />
              </div>
              <SkeletonBlock width="100%" height={5} radius={99} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
