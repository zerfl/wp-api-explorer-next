import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRequestGuard } from "@/lib/use-request-guard";

describe("useRequestGuard", () => {
  it("abortCurrent cancels the request but keeps its ticket current", () => {
    const { result } = renderHook(() => useRequestGuard());
    const ticket = result.current.begin();

    result.current.abortCurrent();

    expect(ticket.signal.aborted).toBe(true);
    expect(ticket.isCurrent()).toBe(true);
  });

  it("invalidate cancels the request and makes its ticket stale", () => {
    const { result } = renderHook(() => useRequestGuard());
    const ticket = result.current.begin();

    result.current.invalidate();

    expect(ticket.signal.aborted).toBe(true);
    expect(ticket.isCurrent()).toBe(false);
    expect(result.current.begin().isCurrent()).toBe(true);
  });
});
