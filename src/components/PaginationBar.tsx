import React from "react";
import { Download, RotateCcw, Square } from "lucide-react";
import { SmartPagination } from "@/components/SmartPagination";
import { Button } from "@/components/ui/button";
import type { BulkKind } from "@/lib/page-range";
import type { BulkLoadState } from "@/lib/use-page-range-load";

interface PaginationBarProps {
  currentPage: number;
  totalPages: number | null;
  isLoading: boolean;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
  bulkLoad: BulkLoadState | null;
  /** Null hides the bulk actions entirely. */
  bulkActions: { next10: boolean; all: number | null } | null;
  onLoadMore: (kind: BulkKind) => void;
  onStop: () => void;
  onRetry: () => void;
  onExit: () => void;
  onDownload: (() => void) | null;
}

export function PaginationBar({
  currentPage,
  totalPages,
  isLoading,
  hasNextPage,
  onPageChange,
  bulkLoad,
  bulkActions,
  onLoadMore,
  onStop,
  onRetry,
  onExit,
  onDownload,
}: PaginationBarProps) {
  const running = bulkLoad?.status === "running";

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
      <SmartPagination
        currentPage={currentPage}
        totalPages={totalPages}
        isLoading={isLoading || running}
        onPageChange={onPageChange}
        hasNextPage={hasNextPage}
        rangeEnd={bulkLoad?.lastLoadedPage}
      />

      {running ? (
        <Button variant="outline" className="h-10 text-sm" onClick={onStop}>
          <Square className="h-3.5 w-3.5" aria-hidden="true" />
          Stop · {bulkLoad.lastLoadedPage - bulkLoad.runFrom + 1}/{bulkLoad.runTo - bulkLoad.runFrom + 1} pages
        </Button>
      ) : isLoading ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {bulkLoad?.status === "failed" && bulkLoad.failedPage !== null ? (
            <Button variant="outline" className="h-10 text-sm" onClick={onRetry}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry from page {bulkLoad.failedPage}
            </Button>
          ) : null}
          {bulkActions?.next10 ? (
            <Button variant="outline" className="h-10 text-sm" onClick={() => onLoadMore("next10")}>
              +10 pages
            </Button>
          ) : null}
          {bulkActions?.all ? (
            <Button variant="outline" className="h-10 text-sm" onClick={() => onLoadMore("all")}>
              Load all remaining ({bulkActions.all})
            </Button>
          ) : null}
          {onDownload ? (
            <Button variant="ghost" className="h-10 text-sm" onClick={onDownload}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download URLs
            </Button>
          ) : null}
          {bulkLoad ? (
            <Button variant="ghost" className="h-10 text-sm" onClick={onExit}>
              Show page {bulkLoad.firstPage} only
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
