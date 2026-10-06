import { describe, expect, it } from "vitest";
import { parsePageInput } from "@/lib/pagination";

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
