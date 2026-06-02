import {
  StatCardSkeleton,
  TableRowSkeleton,
  PageHeaderSkeleton,
  SkeletonStyles,
} from "@/components/skeletons/PageSkeletons";

export default function AdminLoading() {
  return (
    <div>
      <SkeletonStyles />
      <PageHeaderSkeleton />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {[...Array(6)].map((_, i) => <TableRowSkeleton key={i} cols={5} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
