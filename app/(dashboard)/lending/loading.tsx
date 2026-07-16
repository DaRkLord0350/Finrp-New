import { StatCardSkeleton, ChartSkeleton, PageHeaderSkeleton, SkeletonStyles } from "@/components/skeletons/PageSkeletons";

export default function LendingLoading() {
  return (
    <div>
      <SkeletonStyles />
      <PageHeaderSkeleton />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <ChartSkeleton height={260} />
        <ChartSkeleton height={260} />
      </div>
    </div>
  );
}
