import {
  StatCardSkeleton,
  ChartSkeleton,
  PageHeaderSkeleton,
  SkeletonStyles,
  SkeletonBlock,
} from "@/components/skeletons/PageSkeletons";

export default function LoansLoading() {
  return (
    <div>
      <SkeletonStyles />
      <PageHeaderSkeleton />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <ChartSkeleton height={200} />
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
              <SkeletonBlock width="40%" height={13} />
              <SkeletonBlock width="25%" height={13} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
