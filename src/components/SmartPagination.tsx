import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

interface SmartPaginationProps {
  currentPage: number;
  totalPages: number | null;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

export function SmartPagination({
  currentPage,
  totalPages,
  isLoading,
  onPageChange,
}: SmartPaginationProps) {
  const getPageNumbers = () => {
    if (!totalPages) return [];

    const delta = 2; // 2 pages on each side of the current page
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        range.push(i);
      }
    }

    for (const i of range) {
      if (l !== undefined) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  const pages = getPageNumbers();

  // If no totalPages, fallback to simple Previous / Next
  if (!totalPages) {
    return (
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          disabled={isLoading || currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="h-10 w-10"
        >
          <span className="sr-only">Previous page</span>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span
          aria-live="polite"
          className="min-w-[92px] text-center text-sm font-semibold text-foreground/80 px-3"
        >
          Page {currentPage}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={isLoading}
          onClick={() => onPageChange(currentPage + 1)}
          className="h-10 w-10"
        >
          <span className="sr-only">Next page</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </nav>
    );
  }

  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        disabled={isLoading || currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="h-10 w-10 shrink-0"
      >
        <span className="sr-only">Previous page</span>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>

      <div className="hidden md:flex items-center gap-1">
        {pages.map((page, index) => {
          if (page === "...") {
            return (
              <div
                key={`ellipsis-${index}`}
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center"
              >
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </div>
            );
          }

          const pageNumber = page as number;
          const isActive = pageNumber === currentPage;

          return (
            <Button
              key={`page-${pageNumber}`}
              variant={isActive ? "default" : "outline"}
              aria-label={`Go to page ${pageNumber}`}
              aria-current={isActive ? "page" : undefined}
              className={`h-10 w-10 shrink-0 ${
                isActive ? "pointer-events-none" : ""
              }`}
              disabled={isLoading}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </Button>
          );
        })}
      </div>

      {/* Mobile view fallback: just show current of total */}
      <div className="md:hidden flex items-center px-3">
        <span aria-live="polite" className="text-sm font-semibold text-foreground/80">
          Page {currentPage} of {totalPages}
        </span>
      </div>

      <Button
        variant="outline"
        size="icon"
        disabled={isLoading || currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="h-10 w-10 shrink-0"
      >
        <span className="sr-only">Next page</span>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
