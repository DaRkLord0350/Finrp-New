import {
  SkeletonBlock,
  ListItemSkeleton,
  PageHeaderSkeleton,
  SkeletonStyles,
} from "@/components/skeletons/PageSkeletons";

export default function ComplianceLoading() {
  return (
    <div>
      <SkeletonStyles />
      <PageHeaderSkeleton />

      {/* Quick-nav */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
            <SkeletonBlock width={32} height={32} radius={8} />
            <SkeletonBlock width="60%" height={13} />
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ padding: "14px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
            <SkeletonBlock width={30} height={30} radius={8} style={{ marginBottom: 10 }} />
            <SkeletonBlock width="50%" height={22} style={{ marginBottom: 6 }} />
            <SkeletonBlock width="70%" height={10} />
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SkeletonBlock width={160} height={16} style={{ marginBottom: 4 }} />
          {[...Array(5)].map((_, i) => <ListItemSkeleton key={i} />)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[...Array(2)].map((_, i) => (
            <div key={i} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px" }}>
              <SkeletonBlock width="50%" height={14} style={{ marginBottom: 14 }} />
              {[...Array(3)].map((_, j) => (
                <div key={j} style={{ marginBottom: 10 }}>
                  <SkeletonBlock width="75%" height={12} style={{ marginBottom: 4 }} />
                  <SkeletonBlock width="40%" height={10} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
