import {
  StatCardSkeleton,
  TableRowSkeleton,
  PageHeaderSkeleton,
  SkeletonBlock,
  SkeletonStyles,
} from "@/components/skeletons/PageSkeletons";

export default function ChartOfAccountsLoading() {
  return (
    <div>
      <SkeletonStyles />
      <PageHeaderSkeleton />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
          <SkeletonBlock width={160} height={16} style={{ marginBottom: 8 }} />
          <SkeletonBlock width={120} height={11} />
        </div>
        <div style={{ padding: "16px 24px" }}>
          {[...Array(8)].map((_, i) => <TableRowSkeleton key={i} cols={7} />)}
        </div>
      </div>
    </div>
  );
}
