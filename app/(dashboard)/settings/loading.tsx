import {
  SkeletonBlock,
  PageHeaderSkeleton,
  SkeletonStyles,
} from "@/components/skeletons/PageSkeletons";

export default function SettingsLoading() {
  return (
    <div>
      <SkeletonStyles />
      <PageHeaderSkeleton hasButton={false} />

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
        {/* Settings sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...Array(6)].map((_, i) => (
            <SkeletonBlock key={i} width="100%" height={36} radius={8} />
          ))}
        </div>

        {/* Settings content */}
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
          <SkeletonBlock width="35%" height={20} style={{ marginBottom: 8 }} />
          <SkeletonBlock width="55%" height={14} style={{ marginBottom: 32 }} />
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ marginBottom: 24 }}>
              <SkeletonBlock width="25%" height={13} style={{ marginBottom: 8 }} />
              <SkeletonBlock width="100%" height={40} radius={10} />
            </div>
          ))}
          <SkeletonBlock width={120} height={40} radius={10} />
        </div>
      </div>
    </div>
  );
}
