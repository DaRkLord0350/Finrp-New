import {
  SkeletonBlock,
  CardSkeleton,
  PageHeaderSkeleton,
  SkeletonStyles,
} from "@/components/skeletons/PageSkeletons";

export default function CRMLoading() {
  return (
    <div>
      <SkeletonStyles />
      <PageHeaderSkeleton />

      {/* Search bar */}
      <div style={{ marginBottom: 20 }}>
        <SkeletonBlock width={380} height={38} radius={10} />
      </div>

      {/* Customer card grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {[...Array(6)].map((_, i) => <CardSkeleton key={i} height={190} />)}
      </div>
    </div>
  );
}
