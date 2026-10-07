import React from "react";
import { Loader2, Square } from "lucide-react";
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

function runProgress(bulkLoad: BulkLoadState) {
  const planned = bulkLoad.runTo - bulkLoad.runFrom + 1;
  const completed = bulkLoad.lastLoadedPage - bulkLoad.runFrom + 1;
  return { planned, completed, percent: Math.round((completed / planned) * 100) };
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function BulkLoadStatus({ bulkLoad }: { bulkLoad: BulkLoadState }) {
  const running = bulkLoad.status === "running";
  const { planned, completed, percent } = runProgress(bulkLoad);

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
          <ProgressBar percent={percent} />
        </div>
      ) : (
        <p>{summary(bulkLoad)}</p>
      )}
    </div>
  );
}

/**
 * Pinned to the bottom of the viewport while a run is going and neither the
 * status block nor the bottom pager is on screen. Not a live region:
 * `BulkLoadStatus` already announces progress.
 */
export function BulkLoadDock({ bulkLoad, onStop }: { bulkLoad: BulkLoadState; onStop: () => void }) {
  const { planned, completed, percent } = runProgress(bulkLoad);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto w-full max-w-md space-y-2 rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-foreground">
              Loading pages {bulkLoad.runFrom}–{bulkLoad.runTo}
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {completed} of {planned} pages · {formatCount(bulkLoad.itemsLoaded)} items shown
            </p>
          </div>
          <button
            type="button"
            onClick={onStop}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Stop
          </button>
        </div>
        <ProgressBar percent={percent} />
      </div>
    </div>
  );
}
