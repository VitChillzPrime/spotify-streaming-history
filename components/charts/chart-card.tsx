"use client";

import { ChartColumn, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, type TableData } from "@/components/ui/data-table";

/** A card holding a chart, with a toggle to its accessible table twin. */
export function ChartCard({
  title,
  description,
  action,
  table,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Builds the table view lazily, only when it's shown. */
  table?: () => TableData;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        description={description}
        action={
          (action || table) && (
            <>
              {action}
              {table && (
                <IconButton
                  label={showTable ? "Show chart" : "Show as table"}
                  aria-pressed={showTable}
                  onClick={() => setShowTable((value) => !value)}
                >
                  {showTable ? <ChartColumn /> : <Table2 />}
                </IconButton>
              )}
            </>
          )
        }
      />
      <CardBody className={bodyClassName}>
        {showTable && table ? <DataTable data={table()} caption={typeof title === "string" ? title : undefined} /> : children}
      </CardBody>
    </Card>
  );
}
