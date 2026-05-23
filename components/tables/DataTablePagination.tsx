"use client";

import { Button } from "@/components/ui/Button";
import { Table } from "@tanstack/react-table";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex items-center justify-end gap-2 py-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          table.previousPage()
        }
        disabled={
          !table.getCanPreviousPage()
        }
      >
        Previous
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          table.nextPage()
        }
        disabled={
          !table.getCanNextPage()
        }
      >
        Next
      </Button>
    </div>
  );
}