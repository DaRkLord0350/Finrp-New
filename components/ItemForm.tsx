// Client component — inherits "use client" boundary from parent page

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";

const itemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional(),
  stock: z.number().int().min(0, "Stock must be 0 or more"),
  lowStockAt: z.number().int().min(1, "Low stock threshold must be at least 1"),
});

type ItemFormData = z.infer<typeof itemSchema>;

interface Item {
  id: string;
  name: string;
  description?: string | null;
  stock: number;
  lowStockAt: number;
}

interface ItemFormProps {
  item?: Item | null;
  onSuccess: () => void;
  onClose: () => void;
}

export default function ItemForm({ item, onSuccess, onClose }: ItemFormProps) {
  const isEdit = !!item;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: item?.name ?? "",
      description: item?.description ?? "",
      stock: item?.stock ?? 0,
      lowStockAt: item?.lowStockAt ?? 10,
    },
  });

  useEffect(() => {
    reset({
      name: item?.name ?? "",
      description: item?.description ?? "",
      stock: item?.stock ?? 0,
      lowStockAt: item?.lowStockAt ?? 10,
    });
  }, [item, reset]);

  const onSubmit = async (data: ItemFormData) => {
    try {
      const url = isEdit ? `/api/items/${item!.id}` : "/api/items";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Request failed");
      onSuccess();
      onClose();
    } catch {
      alert("Something went wrong. Please try again.");
    }
  };

  const inputStyle = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text-primary)",
    padding: "9px 12px",
    fontSize: 14,
    width: "100%",
    outline: "none",
  };

  const labelStyle = {
    color: "var(--text-secondary)",
    fontSize: 12,
    fontWeight: 500 as const,
    marginBottom: 6,
    display: "block" as const,
  };

  const errorStyle = {
    color: "#ef4444",
    fontSize: 11,
    marginTop: 4,
    display: "block" as const,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 480,
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div>
            <h2
              style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}
            >
              {isEdit ? "Edit Item" : "Add New Item"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              {isEdit ? "Update inventory item details" : "Add a new item to your catalog"}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "6px 8px",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Item Name */}
          <div>
            <label style={labelStyle}>Item Name *</label>
            <input
              {...register("name")}
              placeholder="e.g. Premium Laptop"
              style={inputStyle}
            />
            {errors.name && <span style={errorStyle}>{errors.name.message}</span>}
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              {...register("description")}
              placeholder="Optional item description..."
              rows={3}
              style={{
                ...inputStyle,
                resize: "vertical" as const,
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Stock + Low Stock At */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Stock Quantity *</label>
              <input
                {...register("stock", { valueAsNumber: true })}
                type="number"
                min={0}
                placeholder="0"
                style={inputStyle}
              />
              {errors.stock && <span style={errorStyle}>{errors.stock.message}</span>}
            </div>
            <div>
              <label style={labelStyle}>Low Stock Alert At *</label>
              <input
                {...register("lowStockAt", { valueAsNumber: true })}
                type="number"
                min={1}
                placeholder="10"
                style={inputStyle}
              />
              {errors.lowStockAt && (
                <span style={errorStyle}>{errors.lowStockAt.message}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-brand"
              disabled={isSubmitting}
              style={{ flex: 1, justifyContent: "center" }}
            >
              {isSubmitting
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                ? "Save Changes"
                : "Create Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
