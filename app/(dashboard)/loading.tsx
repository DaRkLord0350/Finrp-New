export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-[var(--bg-elevated)]" />
          <div className="h-4 w-72 rounded-lg bg-[var(--bg-elevated)]" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-[var(--bg-elevated)]" />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-[var(--bg-elevated)]" />
            <div className="h-8 w-32 rounded bg-[var(--bg-elevated)]" />
            <div className="h-3 w-20 rounded bg-[var(--bg-elevated)]" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="surface p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border)]">
          <div className="h-5 w-32 rounded bg-[var(--bg-elevated)]" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border)] last:border-0">
            <div className="h-8 w-8 rounded-full bg-[var(--bg-elevated)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 rounded bg-[var(--bg-elevated)]" />
              <div className="h-3 w-28 rounded bg-[var(--bg-elevated)]" />
            </div>
            <div className="h-6 w-20 rounded-full bg-[var(--bg-elevated)]" />
            <div className="h-4 w-24 rounded bg-[var(--bg-elevated)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
