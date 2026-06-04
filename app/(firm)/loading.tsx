export default function FirmLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 rounded-lg bg-[var(--bg-elevated)]" />
          <div className="h-4 w-64 rounded-lg bg-[var(--bg-elevated)]" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-[var(--bg-elevated)]" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface p-5 space-y-3">
            <div className="h-4 w-20 rounded bg-[var(--bg-elevated)]" />
            <div className="h-8 w-28 rounded bg-[var(--bg-elevated)]" />
          </div>
        ))}
      </div>
      <div className="surface p-0 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border)] last:border-0">
            <div className="h-8 w-8 rounded-full bg-[var(--bg-elevated)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-36 rounded bg-[var(--bg-elevated)]" />
              <div className="h-3 w-24 rounded bg-[var(--bg-elevated)]" />
            </div>
            <div className="h-6 w-16 rounded-full bg-[var(--bg-elevated)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
