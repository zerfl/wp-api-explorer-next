import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SmartPagination } from "@/components/SmartPagination";

describe("SmartPagination", () => {
  it("marks the active page with aria-current and fires onPageChange", () => {
    const onPageChange = vi.fn();
    render(
      <SmartPagination
        currentPage={3}
        totalPages={5}
        isLoading={false}
        onPageChange={onPageChange}
      />
    );

    const nav = screen.getByRole("navigation", { name: /pagination/i });
    expect(nav).toBeInTheDocument();

    const active = screen.getByRole("button", { name: "Go to page 3" });
    expect(active).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: "Go to page 4" }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("falls back to labelled prev/next controls without a total", () => {
    render(
      <SmartPagination
        currentPage={2}
        totalPages={null}
        isLoading={false}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /previous page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next page/i })).toBeInTheDocument();
  });
});
