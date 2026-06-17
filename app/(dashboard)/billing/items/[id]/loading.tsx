export default function ItemDetailLoading() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ height: 20, width: 140, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, marginBottom: 20, animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ height: 96, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 24, animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, marginBottom: 24 }}>
        <div style={{ height: 320, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ height: 320, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
      <div style={{ height: 180, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, animation: "pulse 1.5s ease-in-out infinite" }} />
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
