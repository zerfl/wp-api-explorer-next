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

  it("disables Next in the no-total fallback when hasNextPage is false", () => {
    const onPageChange = vi.fn();
    render(
      <SmartPagination
        currentPage={1}
        totalPages={null}
        isLoading={false}
        onPageChange={onPageChange}
        hasNextPage={false}
      />
    );

    const next = screen.getByRole("button", { name: /next page/i });
    expect(next).toBeDisabled();
    fireEvent.click(next);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("jumps to a typed page on Enter", () => {
    const onPageChange = vi.fn();
    render(<SmartPagination currentPage={3} totalPages={200} isLoading={false} onPageChange={onPageChange} />);

    const input = screen.getByRole("textbox", { name: "Go to page" });
    fireEvent.change(input, { target: { value: "150" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onPageChange).toHaveBeenCalledWith(150);
    expect(input).toHaveValue("");
  });

  it("flags an out-of-range page and does not navigate", () => {
    const onPageChange = vi.fn();
    render(<SmartPagination currentPage={3} totalPages={200} isLoading={false} onPageChange={onPageChange} />);

    const input = screen.getByRole("textbox", { name: "Go to page" });
    fireEvent.change(input, { target: { value: "201" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onPageChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Pages run from 1 to 200");
  });

  it("marks an appended range as shown and continues after its end", () => {
    const onPageChange = vi.fn();
    render(
      <SmartPagination currentPage={5} totalPages={20} isLoading={false} onPageChange={onPageChange} rangeEnd={8} />
    );

    for (const page of [5, 6, 7, 8]) {
      expect(screen.getByRole("button", { name: `Go to page ${page}` })).toHaveAttribute("aria-current", "page");
    }
    expect(screen.getByRole("button", { name: "Go to page 9" })).not.toHaveAttribute("aria-current");

    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(9);

    // Picking a page inside the range shows that page on its own.
    fireEvent.click(screen.getByRole("button", { name: "Go to page 6" }));
    expect(onPageChange).toHaveBeenCalledWith(6);
  });
});
