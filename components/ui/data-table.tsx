import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

export interface TableData {
  columns: { label: string; numeric?: boolean }[];
  rows: ReactNode[][];
}

/** The accessible, plain-table twin of a chart. */
export function DataTable({ data, caption, className }: { data: TableData; caption?: string; className?: string }) {
  return (
    <div className={cn("max-h-[420px] overflow-auto rounded-xl border border-line", className)}>
      <table className="w-full border-collapse text-[13px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr>
            {data.columns.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={cn(
                  "px-3 py-2 font-medium whitespace-nowrap text-ink-3",
                  column.numeric ? "text-right" : "text-left",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, r) => (
            <tr key={r} className="border-t border-line">
              {row.map((cell, c) => (
                <td
                  key={c}
                  className={cn(
                    "px-3 py-1.5 text-ink-2",
                    data.columns[c]?.numeric ? "text-right whitespace-nowrap tabular" : "text-left",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
