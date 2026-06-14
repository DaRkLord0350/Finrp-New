export default function CAHubLoading() {
  const bar = (w: string | number, h = 14) => (
    <div style={{ width: w, height: h, borderRadius: 6, background: "var(--border)", animation: "skeletonPulse 1.4s ease-in-out infinite" }} />
  );
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {bar(220, 24)}
        {bar(320, 13)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="section-card" style={{ minHeight: 96, display: "flex", flexDirection: "column", gap: 10 }}>
            {bar("55%", 11)}
            {bar("45%", 26)}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div className="section-card" style={{ minHeight: 280 }}>{bar("40%", 16)}</div>
        <div className="section-card" style={{ minHeight: 280 }}>{bar("50%", 16)}</div>
      </div>
    </div>
  );
}
