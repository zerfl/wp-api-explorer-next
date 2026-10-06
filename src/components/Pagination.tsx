"use client";

import React, { useId, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, RotateCcw, Square, Undo2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BulkKind } from "@/lib/page-range";
import { parsePageInput } from "@/lib/pagination";
import type { BulkLoadState } from "@/lib/use-page-range-load";

export interface PaginationProps {
  currentPage: number;
  /** Last page shown; greater than `currentPage` while pages are appended. */
  lastShown: number;
  totalPages: number | null;
  isLoading: boolean;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
  bulkLoad: BulkLoadState | null;
  /** Null hides the bulk actions. */
  bulkActions: { next10: boolean; all: number | null } | null;
  onLoadMore: (kind: BulkKind) => void;
  onStop: () => void;
  onRetry: () => void;
  onExit: () => void;
  onDownload: (() => void) | null;
}

/** Shows "5–15 / 17"; click to type a page number. */
function PageField({
  currentPage,
  lastShown,
  totalPages,
  disabled,
  onJump,
}: {
  currentPage: number;
  lastShown: number;
  totalPages: number | null;
  disabled: boolean;
  onJump: (page: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const shown = lastShown > currentPage ? `${currentPage}–${lastShown}` : String(currentPage);

  const close = () => {
    setEditing(false);
    setValue("");
    setError(null);
  };

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        aria-label={`${lastShown > currentPage ? `Pages ${shown}` : `Page ${shown}`}${
          totalPages ? ` of ${totalPages}` : ""
        }. Go to page`}
        title="Type a page number"
        className="h-full min-w-28 px-3 text-sm tabular-nums transition-colors hover:bg-muted disabled:opacity-50"
      >
        <span className="font-semibold text-foreground">{shown}</span>
        {totalPages ? <span className="text-muted-foreground"> / {totalPages}</span> : null}
      </button>
    );
  }

  const submit = () => {
    const result = parsePageInput(value, totalPages);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    close();
    onJump(result.page);
  };

  // A form with enterKeyHint="go": without it, Android keyboards show "Next"
  // when another field follows, which moves focus away and discards the input.
  return (
    <form
      className="relative h-full"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <input
        autoFocus
        inputMode="numeric"
        enterKeyHint="go"
        aria-label="Go to page"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder={totalPages ? `1–${totalPages}` : "Page"}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onBlur={close}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            close();
          }
        }}
        className={`h-full w-28 bg-background text-center text-sm font-semibold tabular-nums outline-none ${
          error ? "text-destructive" : ""
        }`}
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-destructive px-2 py-1 text-xs font-medium text-white shadow"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}

function LoadMenu({
  bulkLoad,
  bulkActions,
  isLoading,
  onLoadMore,
  onStop,
  onRetry,
  onExit,
  onDownload,
}: Pick<
  PaginationProps,
  "bulkLoad" | "bulkActions" | "isLoading" | "onLoadMore" | "onStop" | "onRetry" | "onExit" | "onDownload"
>) {
  const [open, setOpen] = useState(false);

  if (bulkLoad?.status === "running") {
    const planned = bulkLoad.runTo - bulkLoad.runFrom + 1;
    const done = bulkLoad.lastLoadedPage - bulkLoad.runFrom + 1;
    return (
      <button
        type="button"
        onClick={onStop}
        className="relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-primary/15 transition-[width]"
          style={{ width: `${(done / planned) * 100}%` }}
        />
        <Square className="relative h-3.5 w-3.5 fill-current" aria-hidden="true" />
        <span className="relative tabular-nums">
          Stop · {done}/{planned}
        </span>
      </button>
    );
  }

  const primary = bulkActions?.next10
    ? { label: "+10 pages", run: () => onLoadMore("next10") }
    : bulkActions?.all
      ? { label: `Load remaining ${bulkActions.all}`, run: () => onLoadMore("all") }
      : null;

  const items: Array<{ label: string; icon: React.ReactNode; run: () => void }> = [];
  if (bulkLoad?.status === "failed" && bulkLoad.failedPage !== null) {
    items.push({ label: `Retry from page ${bulkLoad.failedPage}`, icon: <RotateCcw />, run: onRetry });
  }
  if (bulkActions?.next10 && bulkActions.all) {
    items.push({ label: `Load all remaining (${bulkActions.all})`, icon: null, run: () => onLoadMore("all") });
  }
  if (onDownload) {
    items.push({ label: "Download URLs", icon: <Download />, run: onDownload });
  }
  if (bulkLoad) {
    items.push({ label: `Back to page ${bulkLoad.firstPage} only`, icon: <Undo2 />, run: onExit });
  }

  if (!primary && items.length === 0) {
    return null;
  }

  return (
    <div className="inline-flex h-10 items-stretch rounded-lg border border-border bg-background">
      {primary ? (
        <button
          type="button"
          disabled={isLoading}
          onClick={primary.run}
          className="rounded-l-lg px-3 text-sm font-medium whitespace-nowrap hover:bg-muted disabled:opacity-50"
        >
          {primary.label}
        </button>
      ) : null}
      {items.length ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            aria-label="More page options"
            disabled={isLoading}
            className={`flex w-9 items-center justify-center rounded-r-lg hover:bg-muted disabled:opacity-50 ${
              primary ? "border-l border-border" : "rounded-l-lg"
            }`}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 gap-0 p-1">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.run();
                }}
                className="flex h-9 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-muted-foreground"
              >
                {item.icon ?? <span className="w-4" aria-hidden="true" />}
                {item.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

export function Pagination(props: PaginationProps) {
  const { currentPage, lastShown, totalPages, isLoading, hasNextPage, onPageChange, bulkLoad } = props;
  const busy = isLoading || bulkLoad?.status === "running";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav
        aria-label="Pagination"
        className="inline-flex h-10 items-stretch rounded-lg border border-border bg-background"
      >
        <button
          type="button"
          aria-label="Previous page"
          disabled={busy || currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="flex w-10 items-center justify-center rounded-l-lg border-r border-border hover:bg-muted disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <PageField
          currentPage={currentPage}
          lastShown={lastShown}
          totalPages={totalPages}
          disabled={busy}
          onJump={(page) => {
            // Re-requesting the single page already shown would only refetch it.
            if (page !== currentPage || lastShown > currentPage) {
              onPageChange(page);
            }
          }}
        />
        <button
          type="button"
          aria-label="Next page"
          disabled={busy || (totalPages ? lastShown >= totalPages : !hasNextPage)}
          onClick={() => onPageChange(lastShown + 1)}
          className="flex w-10 items-center justify-center rounded-r-lg border-l border-border hover:bg-muted disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </nav>
      <LoadMenu {...props} />
    </div>
  );
}
