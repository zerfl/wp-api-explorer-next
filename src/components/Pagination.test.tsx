import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Pagination, PaginationProps } from "@/components/Pagination";
import type { BulkLoadState } from "@/lib/use-page-range-load";

function setup(overrides: Partial<PaginationProps> = {}) {
  const props: PaginationProps = {
    currentPage: 5,
    lastShown: 5,
    totalPages: 17,
    isLoading: false,
    hasNextPage: true,
    onPageChange: vi.fn(),
    bulkLoad: null,
    bulkActions: { next10: true, all: 12 },
    onLoadMore: vi.fn(),
    onStop: vi.fn(),
    onRetry: vi.fn(),
    onExit: vi.fn(),
    onDownload: vi.fn(),
    ...overrides,
  };
  render(<Pagination {...props} />);
  return props;
}

const loaded = (overrides: Partial<BulkLoadState> = {}): BulkLoadState => ({
  status: "done",
  firstPage: 5,
  lastLoadedPage: 15,
  runFrom: 6,
  runTo: 15,
  itemsLoaded: 1092,
  duplicatesSkipped: 0,
  endedEarly: false,
  mayContinue: true,
  error: null,
  failedPage: null,
  ...overrides,
});

describe("Pagination", () => {
  it("steps around a loaded range: back from its first page, forward from its last", () => {
    const props = setup({ lastShown: 15, bulkLoad: loaded(), bulkActions: { next10: false, all: 2 } });

    expect(screen.getByRole("button", { name: /Pages 5–15 of 17/ })).toHaveTextContent("5–15 / 17");
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(props.onPageChange).toHaveBeenNthCalledWith(1, 4);
    expect(props.onPageChange).toHaveBeenNthCalledWith(2, 16);
  });

  it("jumps to a typed page", () => {
    const props = setup();

    fireEvent.click(screen.getByRole("button", { name: /Page 5 of 17/ }));
    const input = screen.getByRole("textbox", { name: "Go to page" });
    // "Go", not "Next": a Next key moves focus to the following field and drops the input.
    expect(input).toHaveAttribute("enterkeyhint", "go");
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.submit(input.closest("form")!);

    expect(props.onPageChange).toHaveBeenCalledWith(12);
  });

  it("rejects an out-of-range page without navigating", () => {
    const props = setup();

    fireEvent.click(screen.getByRole("button", { name: /Page 5 of 17/ }));
    const input = screen.getByRole("textbox", { name: "Go to page" });
    fireEvent.change(input, { target: { value: "18" } });
    fireEvent.submit(input.closest("form")!);

    expect(props.onPageChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Pages run from 1 to 17");
  });

  it("leads with +10 pages when more than 10 remain", () => {
    const props = setup();

    fireEvent.click(screen.getByRole("button", { name: "+10 pages" }));
    expect(props.onLoadMore).toHaveBeenCalledWith("next10");
  });

  it("leads with loading the rest when 10 or fewer remain", () => {
    const props = setup({ currentPage: 12, lastShown: 12, bulkActions: { next10: false, all: 5 } });

    expect(screen.queryByRole("button", { name: "+10 pages" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load remaining 5" }));
    expect(props.onLoadMore).toHaveBeenCalledWith("all");
  });

  it("swaps the actions for a Stop button showing progress while loading", () => {
    const props = setup({ bulkLoad: loaded({ status: "running", lastLoadedPage: 8 }) });

    fireEvent.click(screen.getByRole("button", { name: /Stop · 3\/10/ }));
    expect(props.onStop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });
});
