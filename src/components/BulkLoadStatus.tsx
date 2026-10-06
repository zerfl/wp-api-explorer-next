import React from "react";
import { Loader2 } from "lucide-react";
import type { BulkLoadState } from "@/lib/use-page-range-load";

const formatCount = (value: number) => value.toLocaleString();

function summary(bulkLoad: BulkLoadState): string {
  const pages =
    bulkLoad.firstPage === bulkLoad.lastLoadedPage
      ? `page ${bulkLoad.firstPage}`
      : `pages ${bulkLoad.firstPage}–${bulkLoad.lastLoadedPage}`;
  const shown = `${pages} (${formatCount(bulkLoad.itemsLoaded)} items)`;
  const duplicates = bulkLoad.duplicatesSkipped
    ? ` ${formatCount(bulkLoad.duplicatesSkipped)} duplicates skipped; the collection changed while loading.`
    : "";

  switch (bulkLoad.status) {
    case "stopped":
      return `Stopped. Showing ${shown}.${duplicates}`;
    case "failed":
      return `Page ${bulkLoad.failedPage} failed: ${bulkLoad.error} Showing ${shown}.${duplicates}`;
    case "done":
      return `Loaded ${shown}.${
        bulkLoad.endedEarly ? ` The collection ends at page ${bulkLoad.lastLoadedPage}.` : ""
      }${duplicates}`;
    default:
      return "";
  }
}

export function BulkLoadStatus({ bulkLoad }: { bulkLoad: BulkLoadState }) {
  const running = bulkLoad.status === "running";
  const planned = bulkLoad.runTo - bulkLoad.runFrom + 1;
  const completed = bulkLoad.lastLoadedPage - bulkLoad.runFrom + 1;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={running}
      className={`rounded-xl border p-4 text-sm ${
        bulkLoad.status === "failed"
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-border/30 bg-card/10 text-muted-foreground"
      }`}
    >
      {running ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
            <span className="text-base font-semibold text-foreground">
              Loading pages {bulkLoad.runFrom}–{bulkLoad.runTo}
            </span>
          </div>
          <p>
            {completed} of {planned} pages · {formatCount(bulkLoad.itemsLoaded)} items shown
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${Math.round((completed / planned) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <p>{summary(bulkLoad)}</p>
      )}
    </div>
  );
}
