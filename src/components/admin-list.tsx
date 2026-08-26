import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  label: string;
  hideOnMobile?: boolean;
  className?: string;
  render: (row: T) => ReactNode;
};

export function AdminList<T extends { id?: string }>({
  columns,
  rows,
  empty = "Nothing here yet.",
  onRow,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  onRow?: (row: T) => void;
}) {
  if (rows.length === 0) {
    return (
      <Card className="py-10 text-center text-sm text-muted">{empty}</Card>
    );
  }
  return (
    <>
      <div className="space-y-2 lg:hidden">
        {rows.map((row, i) => (
          <button
            key={row.id ?? i}
            type="button"
            disabled={!onRow}
            onClick={() => onRow?.(row)}
            className="block w-full rounded-2xl bg-surface p-4 text-left shadow-[var(--shadow-card)]"
          >
            {columns.slice(0, 4).map((col) => (
              <div key={col.key} className="flex items-baseline justify-between gap-3 py-0.5">
                <span className="text-[11px] uppercase tracking-wider text-muted">{col.label}</span>
                <span className="min-w-0 truncate text-sm">{col.render(row)}</span>
              </div>
            ))}
          </button>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-[var(--shadow-card)] lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
              {columns.map((col) => (
                <th key={col.key} className={cn("px-4 py-3 font-medium", col.className)}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id ?? i}
                className={cn("border-b border-border last:border-0", onRow && "cursor-pointer hover:bg-surface-2")}
                onClick={() => onRow?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-3 align-middle", col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
