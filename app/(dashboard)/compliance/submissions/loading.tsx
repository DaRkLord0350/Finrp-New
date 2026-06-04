import {
  ListItemSkeleton,
  PageHeaderSkeleton,
  SkeletonBlock,
  SkeletonStyles,
} from "@/components/skeletons/PageSkeletons";

export default function SubmissionsLoading() {
  return (
    <div>
      <SkeletonStyles />
      <PageHeaderSkeleton />
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <SkeletonBlock width={280} height={38} radius={10} />
        {[...Array(4)].map((_, i) => <SkeletonBlock key={i} width={80} height={32} radius={8} />)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[...Array(7)].map((_, i) => <ListItemSkeleton key={i} />)}
      </div>
    </div>
  );
}
