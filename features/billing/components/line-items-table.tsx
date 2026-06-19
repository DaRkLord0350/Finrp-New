"use client";

import { useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Trash2, Plus, GripVertical, PackagePlus, Layers } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";
import { ItemPicker } from "./item-picker";
import { BulkAddModal } from "./bulk-add-modal";
import type { LineItem, InventoryItem } from "../types";

interface Props {
  lineItems: LineItem[];
  inventoryItems: InventoryItem[];
  currency?: string;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<LineItem>) => void;
  onItemSelect: (lineId: string, item: InventoryItem | null) => void;
  /** Provide to enable drag-to-reorder. */
  onReorder?: (items: LineItem[]) => void;
  /** Provide to enable bulk add from catalog. */
  onBulkAdd?: (items: InventoryItem[]) => void;
  /** Provide to enable inline "save to catalog". */
  onCreateInline?: (lineId: string, payload: { name: string; price: number }) => Promise<unknown>;
}

const COLUMNS = ["", "Catalog", "Description", "HSN/SAC", "Qty", "Unit", "Rate", "Disc", "Tax %", "Amount", ""];
const GRID = "22px 132px minmax(150px,1fr) 80px 56px 62px 92px 78px 56px 100px 30px";

const lineNet = (i: LineItem) => Math.max(0, i.quantity * i.unitPrice - (i.discount ?? 0));

export function LineItemsTable({
  lineItems, inventoryItems, currency = "INR",
  onAdd, onRemove, onUpdate, onItemSelect, onReorder, onBulkAdd, onCreateInline,
}: Props) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const canDrag = !!onReorder && lineItems.length > 1;

  const header = (
    <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, marginBottom: 6, paddingLeft: 4, minWidth: 760 }}>
      {COLUMNS.map((h, i) => (
        <span key={i} className="label" style={{ marginBottom: 0, fontSize: 10, textAlign: ["Qty", "Rate", "Disc", "Tax %", "Amount"].includes(h) ? "right" : "left" }}>
          {h}
        </span>
      ))}
    </div>
  );

  const rowProps = { inventoryItems, currency, onRemove, onUpdate, onItemSelect, onCreateInline, canDelete: lineItems.length > 1 };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Line Items</h3>
        {onBulkAdd && (
          <button type="button" className="btn-ghost" style={{ fontSize: 12, gap: 6, padding: "6px 10px" }} onClick={() => setBulkOpen(true)}>
            <Layers size={13} /> Bulk add
          </button>
        )}
      </div>

      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        {header}

        {canDrag ? (
          <Reorder.Group axis="y" values={lineItems} onReorder={onReorder!} as="div" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 760, listStyle: "none", margin: 0, padding: 0 }}>
            {lineItems.map((item) => (
              <DraggableRow key={item.id} item={item} {...rowProps} />
            ))}
          </Reorder.Group>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 760 }}>
            {lineItems.map((item) => (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, alignItems: "center" }}>
                <span style={{ width: 22 }} />
                <RowFields item={item} {...rowProps} />
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={onAdd} className="btn-ghost" style={{ marginTop: 12, gap: 6, fontSize: 13 }}>
        <Plus size={14} /> Add line item
      </button>

      {bulkOpen && onBulkAdd && (
        <BulkAddModal
          items={inventoryItems}
          currency={currency}
          onClose={() => setBulkOpen(false)}
          onConfirm={(selected) => {
            onBulkAdd(selected);
            setBulkOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ── Draggable row (framer-motion Reorder.Item with a grip handle) ──
interface RowProps {
  item: LineItem;
  inventoryItems: InventoryItem[];
  currency: string;
  canDelete: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<LineItem>) => void;
  onItemSelect: (lineId: string, item: InventoryItem | null) => void;
  onCreateInline?: (lineId: string, payload: { name: string; price: number }) => Promise<unknown>;
}

function DraggableRow(props: RowProps) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={props.item}
      as="div"
      dragListener={false}
      dragControls={controls}
      style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, alignItems: "center", listStyle: "none" }}
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        aria-label="Drag to reorder"
        style={{ background: "none", border: "none", cursor: "grab", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, touchAction: "none" }}
      >
        <GripVertical size={14} />
      </button>
      <RowFields {...props} />
    </Reorder.Item>
  );
}

// ── Shared row inputs (catalog → amount + delete) ──
function RowFields({ item, inventoryItems, currency, canDelete, onRemove, onUpdate, onItemSelect, onCreateInline }: RowProps) {
  const [savingItem, setSavingItem] = useState(false);
  const canSaveToCatalog = !!onCreateInline && !item.itemId && item.description.trim().length > 0 && item.unitPrice > 0;

  return (
    <>
      <div style={{ position: "relative" }}>
        <ItemPicker items={inventoryItems} selectedId={item.itemId} onSelect={(inv) => onItemSelect(item.id, inv)} />
        {canSaveToCatalog && (
          <button
            type="button"
            title="Save this line as a catalog item"
            disabled={savingItem}
            onClick={async () => {
              setSavingItem(true);
              try {
                await onCreateInline!(item.id, { name: item.description.trim(), price: item.unitPrice });
              } finally {
                setSavingItem(false);
              }
            }}
            style={{ position: "absolute", top: -7, right: -7, background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 6, padding: 2, cursor: "pointer", color: "#818cf8", display: "flex" }}
          >
            <PackagePlus size={11} />
          </button>
        )}
      </div>

      <input className="input" placeholder="Description…" value={item.description} onChange={(e) => onUpdate(item.id, { description: e.target.value })} />
      <input className="input" placeholder="HSN/SAC" value={item.hsnSac ?? ""} onChange={(e) => onUpdate(item.id, { hsnSac: e.target.value })} />
      <input type="number" className="input" style={{ textAlign: "right" }} min={0.01} step={0.01} value={item.quantity} onChange={(e) => onUpdate(item.id, { quantity: parseFloat(e.target.value) || 0 })} />
      <input className="input" placeholder="pcs" value={item.unit ?? ""} onChange={(e) => onUpdate(item.id, { unit: e.target.value })} />
      <input type="number" className="input" style={{ textAlign: "right" }} placeholder="0.00" min={0} step={0.01} value={item.unitPrice || ""} onChange={(e) => onUpdate(item.id, { unitPrice: parseFloat(e.target.value) || 0 })} />
      <input type="number" className="input" style={{ textAlign: "right" }} placeholder="0" min={0} step={0.01} value={item.discount || ""} onChange={(e) => onUpdate(item.id, { discount: parseFloat(e.target.value) || 0 })} />
      <input type="number" className="input" style={{ textAlign: "right" }} placeholder="0" min={0} max={100} step={0.5} value={item.taxPercent || ""} onChange={(e) => onUpdate(item.id, { taxPercent: parseFloat(e.target.value) || 0 })} />

      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textAlign: "right", padding: "9px 0" }}>
        {formatCurrency(lineNet(item), currency)}
      </div>

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        disabled={!canDelete}
        aria-label="Remove line item"
        style={{ background: "none", border: "none", cursor: canDelete ? "pointer" : "not-allowed", color: canDelete ? "#ef4444" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 36, borderRadius: 8, padding: 0 }}
      >
        <Trash2 size={14} />
      </button>
    </>
  );
}
