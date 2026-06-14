export default function CALoading() {
  return (
    <div className="flex flex-col gap-6 p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-[var(--bg-elevated)]" />
          <div className="h-4 w-60 rounded-lg bg-[var(--bg-elevated)]" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="surface p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-[var(--bg-elevated)]" />
            <div className="h-8 w-20 rounded bg-[var(--bg-elevated)]" />
          </div>
        ))}
      </div>

      <div className="surface p-0 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border)] last:border-0">
            <div className="h-4 w-4/5 rounded bg-[var(--bg-elevated)]" />
            <div className="h-6 w-16 rounded-full bg-[var(--bg-elevated)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
