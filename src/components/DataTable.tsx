"use client";

import React, { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Table as TableIcon } from "lucide-react";

interface DataTableProps {
  data: unknown;
}

export default function DataTable({ data }: DataTableProps) {
  // Normalize items to an array of objects
  const items = useMemo(() => {
    const raw = Array.isArray(data) ? data : data ? [data] : [];
    return raw.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object");
  }, [data]);

  // Extract all unique keys from data items
  const columns = useMemo(() => {
    if (items.length === 0) return [];
    
    // Scan up to 5 items to gather keys in case some fields are optional
    const allKeys = new Set<string>();
    items.slice(0, 5).forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (key !== "_embedded" && key !== "_links") {
          allKeys.add(key);
        }
      });
    });

    const list = Array.from(allKeys);
    
    // Sort columns: id first, then title/name, then other common keys, then alphabetical
    const primaryKeys = ["id", "title", "name", "slug", "date", "status", "type"];
    return list.sort((a, b) => {
      const idxA = primaryKeys.indexOf(a);
      const idxB = primaryKeys.indexOf(b);
      
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      
      return a.localeCompare(b);
    });
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border/60 rounded-lg bg-card/10 text-center space-y-2.5">
        <TableIcon className="h-10 w-10 text-muted-foreground/70" aria-hidden="true" />
        <h4 className="text-sm font-semibold text-foreground">No records returned</h4>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          There is no tabular data to preview because the response is empty.
        </p>
      </div>
    );
  }

  const formatCell = (val: unknown) => {
    if (val === null || val === undefined) {
      return <span className="text-muted-foreground/40 italic">-</span>;
    }
    if (typeof val === "boolean") {
      return (
        <Badge variant="outline" className={`text-xs ${val ? "text-green-500 border-green-500/20" : "text-muted-foreground"}`}>
          {String(val)}
        </Badge>
      );
    }
    if (typeof val === "object") {
      if (val !== null && "rendered" in val) {
        const renderedVal = (val as { rendered?: unknown }).rendered;
        if (typeof renderedVal === "string") {
          return (
            <span 
              className="truncate max-w-[250px] block text-sm" 
              title={renderedVal}
              dangerouslySetInnerHTML={{ __html: renderedVal }}
            />
          );
        }
      }
      return (
        <span className="text-muted-foreground/70 font-mono text-xs truncate max-w-[200px] block" title={JSON.stringify(val)}>
          {JSON.stringify(val)}
        </span>
      );
    }
    
    const strVal = String(val);
    
    if (strVal.startsWith("http://") || strVal.startsWith("https://")) {
      return (
        <a 
          href={strVal} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-primary hover:underline truncate max-w-[200px] block font-mono text-xs"
          title={strVal}
        >
          {strVal}
        </a>
      );
    }

    return (
      <span className="truncate max-w-[250px] block font-medium text-sm" title={strVal}>
        {strVal}
      </span>
    );
  };

  return (
    <div className="border border-border/40 rounded-lg bg-background/40 backdrop-blur-md overflow-hidden shadow-sm">
      <ScrollArea className="w-full overflow-x-auto h-[600px]">
        <div className="min-w-full inline-block align-middle">
          <Table className="text-sm select-text">
            <TableCaption className="sr-only">
              Response data: {items.length} rows across {columns.length} columns.
            </TableCaption>
            <TableHeader className="bg-card/25 sticky top-0 backdrop-blur-md z-10">
              <TableRow className="border-b border-border/40 hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead
                    key={col}
                    scope="col"
                    className="font-bold text-foreground py-3.5 capitalize px-4 whitespace-nowrap text-sm"
                  >
                    {col.replace(/_/g, " ")}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row, idx) => (
                <TableRow key={idx} className="border-b border-border/20 hover:bg-card/10 transition-colors">
                  {columns.map((col) => (
                    <TableCell key={col} className="py-3 px-4 max-w-[300px] truncate whitespace-nowrap text-sm">
                      {formatCell(row[col])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
      <div className="bg-card/10 border-t border-border/30 px-4 py-2.5 text-xs text-muted-foreground flex justify-between items-center">
        <span>Displaying {items.length} rows</span>
        <span>{columns.length} columns (excluding embeddings)</span>
      </div>
    </div>
  );
}
