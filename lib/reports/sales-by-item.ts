// ============================================================
// Sales by Item Report
// Combines InvoiceItem + SaleItem linked to Item catalog
// ============================================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveDateRange } from "./filters";
import type { ReportFilters, ReportResult } from "./types";

interface SalesByItemRow {
  itemName:    string;
  sku:         string;
  category:    string;
  qty:         number;
  unitPrice:   number;
  totalSales:  number;
  totalCost:   number;
  totalProfit: number;
  margin:      number;
}

export async function generateSalesByItem(
  organizationId: string,
  filters: ReportFilters
): Promise<ReportResult<SalesByItemRow>> {
  const { startDate, endDate } = resolveDateRange(filters);

  // From invoice items (linked via SKU / description)
  const invoiceItemRows = await prisma.$queryRaw<{
    item_name:    string;
    sku:          string | null;
    category:     string | null;
    total_qty:    string;
    unit_price:   string;
    total_amount: string;
    total_cost:   string;
    total_profit: string;
  }[]>`
    SELECT
      ii.description                       AS item_name,
      ii.sku,
      NULL::text                           AS category,
      COALESCE(SUM(ii.quantity), 0)::text  AS total_qty,
      AVG(ii."unitPrice")::text            AS unit_price,
      COALESCE(SUM(ii.amount), 0)::text    AS total_amount,
      COALESCE(SUM(ii."costPrice" * ii.quantity), 0)::text AS total_cost,
      COALESCE(SUM(ii.profit), 0)::text    AS total_profit
    FROM invoice_items ii
    JOIN invoices inv
      ON inv.id              = ii."invoiceId"
      AND inv."organizationId" = ${organizationId}
      AND inv."issueDate"    BETWEEN ${startDate} AND ${endDate}
      AND inv."deletedAt"    IS NULL
      AND inv.status         != 'CANCELLED'
    ${filters.itemId ? Prisma.sql`WHERE ii.sku = (SELECT sku FROM items WHERE id = ${filters.itemId} LIMIT 1)` : Prisma.empty}
    GROUP BY ii.description, ii.sku
    ORDER BY SUM(ii.amount) DESC NULLS LAST
    LIMIT 100
  `;

  // From sale items (with item catalog link)
  const saleItemRows = await prisma.$queryRaw<{
    item_name:    string;
    sku:          string | null;
    category:     string | null;
    total_qty:    string;
    unit_price:   string;
    total_amount: string;
    total_cost:   string;
    total_profit: string;
  }[]>`
    SELECT
      COALESCE(it.name, si.description) AS item_name,
      it.sku,
      it.category,
      COALESCE(SUM(si.quantity), 0)::text  AS total_qty,
      AVG(si."unitPrice")::text            AS unit_price,
      COALESCE(SUM(si.amount), 0)::text    AS total_amount,
      COALESCE(SUM(si."costPrice" * si.quantity), 0)::text AS total_cost,
      COALESCE(SUM(si.profit), 0)::text    AS total_profit
    FROM sale_items si
    JOIN sales s
      ON s.id              = si."saleId"
      AND s."organizationId" = ${organizationId}
      AND s."saleDate"     BETWEEN ${startDate} AND ${endDate}
      AND s."deletedAt"    IS NULL
      AND s.status         != 'CANCELLED'
    LEFT JOIN items it ON it.id = si."itemId"
    ${filters.itemId ? Prisma.sql`WHERE si."itemId" = ${filters.itemId}` : Prisma.empty}
    GROUP BY COALESCE(it.name, si.description), it.sku, it.category
    ORDER BY SUM(si.amount) DESC NULLS LAST
    LIMIT 100
  `;

  // Merge by item name
  const itemMap = new Map<string, SalesByItemRow>();

  const addRow = (r: typeof invoiceItemRows[0]) => {
    const key = r.sku ?? r.item_name;
    const existing = itemMap.get(key) ?? {
      itemName:    r.item_name,
      sku:         r.sku ?? "",
      category:    r.category ?? "",
      qty:         0,
      unitPrice:   Number(r.unit_price),
      totalSales:  0,
      totalCost:   0,
      totalProfit: 0,
      margin:      0,
    };
    existing.qty         += Number(r.total_qty);
    existing.totalSales  += Number(r.total_amount);
    existing.totalCost   += Number(r.total_cost);
    existing.totalProfit += Number(r.total_profit);
    itemMap.set(key, existing);
  };

  invoiceItemRows.forEach(addRow);
  saleItemRows.forEach(addRow);

  const rows = Array.from(itemMap.values()).map((r) => ({
    ...r,
    margin: r.totalSales > 0
      ? Math.round((r.totalProfit / r.totalSales) * 10000) / 100
      : 0,
  })).sort((a, b) => b.totalSales - a.totalSales);

  const totalSales  = rows.reduce((s, r) => s + r.totalSales, 0);
  const totalCost   = rows.reduce((s, r) => s + r.totalCost, 0);
  const totalProfit = rows.reduce((s, r) => s + r.totalProfit, 0);

  return {
    slug:        "sales-by-item",
    name:        "Sales by Item",
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalItems: rows.length,
      totalSales,
      totalCost,
      totalProfit,
      avgMargin: totalSales > 0 ? Math.round((totalProfit / totalSales) * 10000) / 100 : 0,
    },
    columns: [
      { key: "itemName",    label: "Item",       type: "text",    sortable: true },
      { key: "sku",         label: "SKU",        type: "text" },
      { key: "category",    label: "Category",   type: "text" },
      { key: "qty",         label: "Qty Sold",   type: "number",  align: "right", sortable: true },
      { key: "totalSales",  label: "Revenue",    type: "currency",align: "right", sortable: true },
      { key: "totalCost",   label: "COGS",       type: "currency",align: "right" },
      { key: "totalProfit", label: "Profit",     type: "currency",align: "right", sortable: true },
      { key: "margin",      label: "Margin %",   type: "percent", align: "right", sortable: true },
    ],
    rows,
    totals: { totalSales, totalCost, totalProfit },
  };
}
