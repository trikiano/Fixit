import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

export default function DataTable({ 
  columns, 
  data, 
  isLoading, 
  onRowClick, 
  emptyMessage = "Aucune donnée",
  selectable = false,
  selectedIds = [],
  onSelectionChange = () => {},
  idField = 'id'
}) {
  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <div className="p-4 space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  const allSelected = data?.length > 0 && selectedIds.length === data?.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map(row => row[idField]));
    }
  };

  const toggleRow = (id, e) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(x => x !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <Card className="overflow-hidden border-border/50 shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 transition-none">
              {selectable && (
                <TableHead className="w-10 px-4">
                  <Checkbox 
                    checked={allSelected} 
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              {columns.map((col, i) => (
                <TableHead key={i} className={cn("text-xs font-semibold uppercase tracking-wider text-muted-foreground py-3", col.className)}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-16 text-muted-foreground italic">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data?.map((row, rowIdx) => {
                const isSelected = selectedIds.includes(row[idField]);
                return (
                  <TableRow
                    key={row[idField] || rowIdx}
                    className={cn(
                      "transition-colors group", 
                      onRowClick && "cursor-pointer hover:bg-muted/50",
                      isSelected && "bg-primary/5 hover:bg-primary/10"
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <TableCell className="w-10 px-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={isSelected} 
                          onCheckedChange={(v) => toggleRow(row[idField], { stopPropagation: () => {} })}
                          aria-label={`Select row ${rowIdx}`}
                        />
                      </TableCell>
                    )}
                    {columns.map((col, colIdx) => (
                      <TableCell key={colIdx} className={cn("text-sm py-3", col.cellClassName)}>
                        {col.render ? col.render(row) : row[col.accessor]}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}