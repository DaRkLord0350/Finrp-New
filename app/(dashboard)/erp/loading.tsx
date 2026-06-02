import {
  SkeletonBlock,
  StatCardSkeleton,
  TableRowSkeleton,
  PageHeaderSkeleton,
  SkeletonStyles,
} from "@/components/skeletons/PageSkeletons";

export default function ERPLoading() {
  return (
    <div>
      <SkeletonStyles />
      <PageHeaderSkeleton />

      {/* Top metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
      </div>

      {/* Operations */}
      <div style={{ marginBottom: 24 }}>
        <SkeletonBlock width={100} height={16} style={{ marginBottom: 14 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ padding: "20px 24px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <SkeletonBlock width="55%" height={11} />
                <SkeletonBlock width={32} height={32} radius={8} />
              </div>
              <SkeletonBlock width="40%" height={24} style={{ marginBottom: 10 }} />
              <SkeletonBlock width="100%" height={6} radius={99} />
            </div>
          ))}
        </div>
      </div>

      {/* Projects table */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
          <SkeletonBlock width={130} height={16} />
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {[...Array(4)].map((_, i) => <TableRowSkeleton key={i} cols={5} />)}
          </tbody>
        </table>
      </div>

      {/* Alerts + AI Suggestions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {[...Array(2)].map((_, i) => (
          <div key={i} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)" }}>
              <SkeletonBlock width="50%" height={16} />
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {[...Array(3)].map((_, j) => (
                <div key={j} style={{ height: 60, background: "var(--bg-elevated)", borderRadius: 10, animation: "skeletonPulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
