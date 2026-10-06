import { describe, expect, it } from "vitest";
import { getPageNumbers, parsePageInput } from "@/lib/pagination";

describe("parsePageInput", () => {
  it("accepts a page within range, ignoring surrounding whitespace", () => {
    expect(parsePageInput(" 42 ", 200)).toEqual({ ok: true, page: 42 });
    expect(parsePageInput("1", 200)).toEqual({ ok: true, page: 1 });
    expect(parsePageInput("200", 200)).toEqual({ ok: true, page: 200 });
  });

  it.each(["", "  ", "abc", "-1", "+3", "1.5", "1e3", "3 4"])("rejects %j as not a whole number", (raw) => {
    expect(parsePageInput(raw, 200)).toEqual({ ok: false, message: "Enter a whole page number" });
  });

  it("rejects pages outside the known range", () => {
    expect(parsePageInput("0", 200)).toEqual({ ok: false, message: "Pages run from 1 to 200" });
    expect(parsePageInput("201", 200)).toEqual({ ok: false, message: "Pages run from 1 to 200" });
  });

  it("has no upper bound when the total is unknown", () => {
    expect(parsePageInput("9999", null)).toEqual({ ok: true, page: 9999 });
    expect(parsePageInput("0", null)).toEqual({ ok: false, message: "Pages start at 1" });
  });
});

describe("getPageNumbers", () => {
  it("shows every page when there are few", () => {
    expect(getPageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses gaps around the focus page", () => {
    expect(getPageNumbers(10, 20)).toEqual([1, "...", 8, 9, 10, 11, 12, "...", 20]);
  });

  it("keeps pinned pages visible outside the focus window", () => {
    expect(getPageNumbers(150, 200, 2, [6])).toEqual([1, "...", 6, "...", 148, 149, 150, 151, 152, "...", 200]);
  });

  it("fills a one-page gap with the page instead of an ellipsis", () => {
    expect(getPageNumbers(5, 20)).toEqual([1, 2, 3, 4, 5, 6, 7, "...", 20]);
  });
});
