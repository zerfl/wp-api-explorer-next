import React, { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { getPageNumbers, parsePageInput } from "@/lib/pagination";

interface SmartPaginationProps {
  currentPage: number;
  totalPages: number | null;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  hasNextPage?: boolean;
  /** Last page shown when several pages are appended after `currentPage`. */
  rangeEnd?: number;
}

function PageJumpInput({
  totalPages,
  disabled,
  onJump,
}: {
  totalPages: number | null;
  disabled: boolean;
  onJump: (page: number) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const submit = () => {
    const result = parsePageInput(value, totalPages);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setValue("");
    setError(null);
    onJump(result.page);
  };

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="numeric"
        placeholder="Page"
        aria-label="Go to page"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        title={error ?? "Type a page number and press Enter"}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            submit();
          } else if (event.key === "Escape") {
            setValue("");
            setError(null);
          }
        }}
        onBlur={() => {
          if (!value) {
            setError(null);
          }
        }}
        className="h-10 w-20 bg-background/60 text-center text-sm"
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md border border-destructive/30 bg-background px-2 py-1 text-xs text-destructive shadow-sm"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SmartPagination({
  currentPage,
  totalPages,
  isLoading,
  onPageChange,
  hasNextPage = true,
  rangeEnd,
}: SmartPaginationProps) {
  const lastShown = rangeEnd ?? currentPage;
  const isRange = lastShown > currentPage;

  const jump = (page: number) => {
    // Re-requesting the page already shown on its own would only refetch it.
    if (page !== currentPage || isRange) {
      onPageChange(page);
    }
  };

  const previous = (
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
  );

  const next = (
    <Button
      variant="outline"
      size="icon"
      disabled={isLoading || (totalPages ? lastShown >= totalPages : !hasNextPage)}
      onClick={() => onPageChange(lastShown + 1)}
      className="h-10 w-10 shrink-0"
    >
      <span className="sr-only">Next page</span>
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
    </Button>
  );

  const shownLabel = isRange ? `Pages ${currentPage}–${lastShown}` : `Page ${currentPage}`;
  const jumpInput = <PageJumpInput totalPages={totalPages} disabled={isLoading} onJump={jump} />;

  const pageNumbers = totalPages ? getPageNumbers(lastShown, totalPages, 2, [currentPage]) : [];

  // Without a total, fall back to simple Previous / Next.
  if (!totalPages) {
    return (
      <nav aria-label="Pagination" className="flex items-center gap-1">
        {previous}
        <span
          aria-live="polite"
          className="min-w-[92px] text-center text-sm font-semibold text-foreground/80 px-3"
        >
          {shownLabel}
        </span>
        {next}
        <div className="ml-2">{jumpInput}</div>
      </nav>
    );
  }

  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      {previous}

      <div className="hidden md:flex items-center gap-1">
        {pageNumbers.map((page, index) => {
          if (page === "...") {
            // Pages hidden behind this ellipsis are all shown when it sits inside the range.
            const inRange =
              isRange &&
              (pageNumbers[index - 1] as number) >= currentPage &&
              (pageNumbers[index + 1] as number) <= lastShown;
            return (
              <div
                key={`ellipsis-${index}`}
                aria-hidden="true"
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${inRange ? "bg-primary/20" : ""}`}
              >
                <MoreHorizontal className={`h-4 w-4 ${inRange ? "text-primary" : "text-muted-foreground"}`} />
              </div>
            );
          }

          const isShown = page >= currentPage && page <= lastShown;

          return (
            <Button
              key={`page-${page}`}
              variant={isShown ? "default" : "outline"}
              aria-label={`Go to page ${page}`}
              aria-current={isShown ? "page" : undefined}
              className={`h-10 w-10 shrink-0 ${isShown && !isRange ? "pointer-events-none" : ""}`}
              disabled={isLoading}
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          );
        })}
      </div>

      {/* Mobile view fallback: just show current of total */}
      <div className="md:hidden flex items-center px-3">
        <span aria-live="polite" className="text-sm font-semibold text-foreground/80">
          {shownLabel} of {totalPages}
        </span>
      </div>

      {next}
      <div className="ml-2">{jumpInput}</div>
    </nav>
  );
}
