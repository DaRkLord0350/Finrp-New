"use client";

import { Input } from "@/components/ui/Input";
import { Table } from "@tanstack/react-table";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
}: DataTableToolbarProps<TData>) {
  return (
    <div className="flex items-center py-4">
      <Input
        placeholder="Search..."
        value={
          (table
            .getColumn("name")
            ?.getFilterValue() as string) ??
          ""
        }
        onChange={(event) =>
          table
            .getColumn("name")
            ?.setFilterValue(
              event.target.value
            )
        }
        className="max-w-sm"
      />
    </div>
  );
}