"use client";

interface StockWarningBadgeProps {
  stock: number;
  lowStockAt: number;
}

export default function StockWarningBadge({ stock, lowStockAt }: StockWarningBadgeProps) {
  const isLow = stock < lowStockAt;
  const isMedium = !isLow && stock < lowStockAt * 2;

  if (isLow) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 10px",
          borderRadius: 99,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          background: "rgba(239,68,68,0.12)",
          color: "#ef4444",
          border: "1px solid rgba(239,68,68,0.3)",
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#ef4444",
            flexShrink: 0,
          }}
        />
        Low Stock
      </span>
    );
  }

  if (isMedium) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 10px",
          borderRadius: 99,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          background: "rgba(245,158,11,0.12)",
          color: "#f59e0b",
          border: "1px solid rgba(245,158,11,0.3)",
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#f59e0b",
            flexShrink: 0,
          }}
        />
        Running Low
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        background: "rgba(16,185,129,0.12)",
        color: "#10b981",
        border: "1px solid rgba(16,185,129,0.3)",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "#10b981",
          flexShrink: 0,
        }}
      />
      In Stock
    </span>
  );
}
