import {
  StatCardSkeleton,
  ListItemSkeleton,
  PageHeaderSkeleton,
  SkeletonStyles,
} from "@/components/skeletons/PageSkeletons";

export default function CALoading() {
  return (
    <div>
      <SkeletonStyles />
      <PageHeaderSkeleton />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...Array(5)].map((_, i) => <ListItemSkeleton key={i} />)}
        </div>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>
          {[...Array(4)].map((_, i) => <ListItemSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );
}
