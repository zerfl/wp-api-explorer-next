import { describe, expect, it } from "vitest";
import type { HttpResult } from "@/lib/http";
import {
  createWindowedWalker,
  formatWpDate,
  normalizeWpDate,
  WindowRequest,
} from "@/lib/windowed-walk";

const DAY_MS = 24 * 60 * 60 * 1000;

function ok(items: Array<{ id: number }>, headers: Record<string, string> = {}): HttpResult {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(headers),
    text: JSON.stringify(items),
  };
}

function timeout(): HttpResult {
  return {
    ok: false,
    kind: "timeout",
    status: null,
    statusText: "",
    message: "timed out",
    body: null,
    headers: null,
  };
}

function http(status: number, body: string | null = null): HttpResult {
  return {
    ok: false,
    kind: "http",
    status,
    statusText: "",
    message: "http error",
    body,
    headers: null,
  };
}

function network(): HttpResult {
  return {
    ok: false,
    kind: "network",
    status: null,
    statusText: "",
    message: "network error",
    body: null,
    headers: null,
  };
}

/** Records every request and answers from a per-call responder. Probe = first request. */
function recorder(responder: (req: WindowRequest, index: number) => HttpResult) {
  const requests: WindowRequest[] = [];
  const fetchWindow = async (req: WindowRequest): Promise<HttpResult> => {
    const index = requests.length;
    requests.push({ ...req });
    return responder(req, index);
  };
  return { requests, fetchWindow };
}

function spanDays(req: WindowRequest): number {
  return Math.round((new Date(req.before).getTime() - new Date(req.after).getTime()) / DAY_MS);
}

describe("normalizeWpDate", () => {
  it("appends midnight to a bare date", () => {
    expect(normalizeWpDate("2025-06-01")).toBe("2025-06-01T00:00:00");
  });

  it("appends seconds to a minute-precision timestamp", () => {
    expect(normalizeWpDate("2025-06-01T08:30")).toBe("2025-06-01T08:30:00");
  });

  it("keeps a full timestamp unchanged", () => {
    expect(normalizeWpDate("2025-06-01T08:30:45")).toBe("2025-06-01T08:30:45");
  });

  it("rejects garbage and half-formed input", () => {
    expect(normalizeWpDate("garbage")).toBeNull();
    expect(normalizeWpDate("2025-6-1")).toBeNull();
    expect(normalizeWpDate("2025-06-01 08:30")).toBeNull();
    expect(normalizeWpDate("")).toBeNull();
  });
});

describe("formatWpDate", () => {
  it("renders local wall-clock time with no zone", () => {
    expect(formatWpDate(new Date(2025, 5, 1, 8, 30, 45))).toBe("2025-06-01T08:30:45");
  });
});

describe("createWindowedWalker", () => {
  it("halves the span on a timeout and never exceeds the lowered ceiling afterwards", async () => {
    const { requests, fetchWindow } = recorder((req, index) => {
      if (index === 0) {
        return ok([]); // probe
      }
      // First real window (40d) times out; everything after answers empty.
      if (spanDays(req) >= 40) {
        return timeout();
      }
      return ok([]);
    });

    const walker = createWindowedWalker<{ id: number }>(fetchWindow, {
      perPage: 100,
      start: "2020-01-01T00:00:00",
      end: "2020-12-31T00:00:00",
      initialWindowMs: 40 * DAY_MS,
      ceilingMs: 80 * DAY_MS,
      minWindowMs: DAY_MS,
    });

    const outcome = await walker.collect(1000);
    expect(outcome.status).toBe("ok");

    const windows = requests.slice(1);
    // 40d window timed out, so the retry drops to 20d.
    expect(spanDays(windows[0])).toBe(40);
    expect(spanDays(windows[1])).toBe(20);
    // Every window after the halving stays at or below the new 20d ceiling,
    // even though empty windows would otherwise double past it.
    for (const req of windows.slice(1)) {
      expect(spanDays(req)).toBeLessThanOrEqual(20);
    }
  });

  it("treats a network failure after the probe as a slowness signal and halves", async () => {
    const { requests, fetchWindow } = recorder((req, index) => {
      if (index === 0) {
        return ok([]); // probe succeeds
      }
      // A gateway 503 page with no CORS headers surfaces as kind "network".
      if (spanDays(req) >= 40) {
        return network();
      }
      return ok([]);
    });

    const walker = createWindowedWalker<{ id: number }>(fetchWindow, {
      perPage: 100,
      start: "2020-01-01T00:00:00",
      end: "2020-12-31T00:00:00",
      initialWindowMs: 40 * DAY_MS,
      ceilingMs: 80 * DAY_MS,
      minWindowMs: DAY_MS,
    });

    const outcome = await walker.collect(1000);
    expect(outcome.status).toBe("ok");

    const windows = requests.slice(1);
    expect(spanDays(windows[0])).toBe(40);
    expect(spanDays(windows[1])).toBe(20);
    for (const req of windows.slice(1)) {
      expect(spanDays(req)).toBeLessThanOrEqual(20);
    }
  });

  it("returns unavailable when the probe fails at the network layer", async () => {
    const { requests, fetchWindow } = recorder(() => network());

    const walker = createWindowedWalker<{ id: number }>(fetchWindow, {
      perPage: 100,
      start: "2020-01-01T00:00:00",
      end: "2025-01-01T00:00:00",
    });

    const outcome = await walker.collect(50);
    expect(outcome.status).toBe("unavailable");
    expect(requests).toHaveLength(1);
    // Giving up is not "reached the end bound" — the walk stays resumable for a retry.
    expect(walker.done).toBe(false);
  });

  it("doubles the span after empty windows up to the ceiling then holds", async () => {
    const { requests, fetchWindow } = recorder((_req, index) => (index === 0 ? ok([]) : ok([])));

    const walker = createWindowedWalker<{ id: number }>(fetchWindow, {
      perPage: 100,
      start: "2020-01-01T00:00:00",
      end: "2022-06-01T00:00:00",
      initialWindowMs: 10 * DAY_MS,
      ceilingMs: 80 * DAY_MS,
      minWindowMs: DAY_MS,
    });

    await walker.collect(100000);

    const windows = requests.slice(1);
    expect(windows.slice(0, 6).map(spanDays)).toEqual([10, 20, 40, 80, 80, 80]);
  });

  it("advances the cursor to before minus one second and dedupes overlapping ids", async () => {
    const { requests, fetchWindow } = recorder((_req, index) => {
      if (index === 0) return ok([]); // probe
      if (index === 1) return ok([{ id: 1 }, { id: 2 }]);
      return ok([{ id: 2 }, { id: 3 }]);
    });

    const walker = createWindowedWalker<{ id: number }>(fetchWindow, {
      perPage: 100,
      start: "2020-01-01T00:00:00",
      end: "2025-01-01T00:00:00",
      initialWindowMs: 30 * DAY_MS,
      ceilingMs: 120 * DAY_MS,
      minWindowMs: DAY_MS,
    });

    await walker.collect(3);

    const firstWindow = requests[1];
    const secondWindow = requests[2];
    const expectedAfter = formatWpDate(new Date(new Date(firstWindow.before).getTime() - 1000));
    expect(secondWindow.after).toBe(expectedAfter);
    expect(walker.items.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it("pages a window until x-wp-totalpages, then finishes", async () => {
    const { requests, fetchWindow } = recorder((_req, index) => {
      if (index === 0) return ok([]); // probe
      const base = (index - 1) * 2;
      return ok([{ id: base + 1 }, { id: base + 2 }], { "x-wp-totalpages": "3" });
    });

    const walker = createWindowedWalker<{ id: number }>(fetchWindow, {
      perPage: 2,
      start: "2020-01-01T00:00:00",
      end: "2020-02-01T00:00:00",
      initialWindowMs: 400 * DAY_MS, // one clamped window spanning the whole range
      ceilingMs: 400 * DAY_MS,
      minWindowMs: DAY_MS,
    });

    await walker.collect(100000);

    expect(requests.slice(1).map((req) => req.page)).toEqual([1, 2, 3]);
    expect(walker.items.map((item) => item.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(walker.done).toBe(true);
  });

  it("ends a window on a rest_post_invalid_page_number 400", async () => {
    const invalidPageBody = JSON.stringify({ code: "rest_post_invalid_page_number" });
    const { requests, fetchWindow } = recorder((_req, index) => {
      if (index === 0) return ok([]); // probe
      if (index === 1) return ok([{ id: 1 }, { id: 2 }]);
      if (index === 2) return ok([{ id: 3 }, { id: 4 }]);
      return http(400, invalidPageBody);
    });

    const walker = createWindowedWalker<{ id: number }>(fetchWindow, {
      perPage: 2,
      start: "2020-01-01T00:00:00",
      end: "2020-02-01T00:00:00",
      initialWindowMs: 400 * DAY_MS,
      ceilingMs: 400 * DAY_MS,
      minWindowMs: DAY_MS,
    });

    await walker.collect(100000);

    expect(requests.slice(1).map((req) => req.page)).toEqual([1, 2, 3]);
    expect(walker.items.map((item) => item.id)).toEqual([1, 2, 3, 4]);
    expect(walker.done).toBe(true);
  });

  it("returns unavailable on a failing probe and issues no window requests", async () => {
    const { requests, fetchWindow } = recorder(() => http(503));

    const walker = createWindowedWalker<{ id: number }>(fetchWindow, {
      perPage: 100,
      start: "2020-01-01T00:00:00",
      end: "2025-01-01T00:00:00",
    });

    const outcome = await walker.collect(50);
    expect(outcome.status).toBe("unavailable");
    expect(requests).toHaveLength(1);
    // Giving up is not "reached the end bound" — the walk stays resumable for a retry.
    expect(walker.done).toBe(false);
  });

  it("stops at the batch size and resumes from the stored cursor", async () => {
    let nextId = 1;
    const { requests, fetchWindow } = recorder((_req, index) => {
      if (index === 0) return ok([]); // probe
      const items = Array.from({ length: 50 }, () => ({ id: nextId++ }));
      return ok(items); // 50 < perPage 100 → window finishes each call
    });

    const walker = createWindowedWalker<{ id: number }>(fetchWindow, {
      perPage: 100,
      start: "2020-01-01T00:00:00",
      end: "2025-01-01T00:00:00",
      initialWindowMs: 30 * DAY_MS,
      ceilingMs: 120 * DAY_MS,
      minWindowMs: DAY_MS,
    });

    const first = await walker.collect(100);
    expect(first.status).toBe("ok");
    expect(walker.items.length).toBeGreaterThanOrEqual(100);
    // probe + exactly two windows to reach 100.
    expect(requests).toHaveLength(3);

    const cursorAfterFirst = walker.cursor;

    const second = await walker.collect(150);
    expect(second.status).toBe("ok");
    expect(walker.items.length).toBe(150);
    // Only one additional window request — earlier windows are not re-fetched.
    expect(requests).toHaveLength(4);
    expect(requests[3].after).toBe(cursorAfterFirst);
  });
});
