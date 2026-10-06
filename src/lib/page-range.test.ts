import { describe, expect, it } from "vitest";
import type { HttpFailure } from "@/lib/http";
import {
  getBulkActions,
  mergeUnique,
  PageCommit,
  PageFetchResult,
  planBulkTarget,
  runPageRange,
} from "@/lib/page-range";

type Item = { id: number };
type Result = PageFetchResult<Item>;

const failure: HttpFailure = {
  ok: false,
  kind: "http",
  status: 503,
  statusText: "Service Unavailable",
  message: "Server error (503).",
  body: null,
  headers: null,
};

function itemsFor(page: number, count = 2): Result {
  return {
    kind: "items",
    items: Array.from({ length: count }, (_, i) => ({ id: page * 100 + i })),
    totalPages: 50,
    totalRecords: 100,
  };
}

/** A fetchPage whose responses the test resolves by hand, in any order. */
function controlledFetcher() {
  const pending = new Map<number, (result: Result) => void>();
  const requested: number[] = [];
  let active = 0;
  let maxActive = 0;

  const fetchPage = (page: number, signal: AbortSignal) =>
    new Promise<Result>((resolve) => {
      requested.push(page);
      active++;
      maxActive = Math.max(maxActive, active);
      const settle = (result: Result) => {
        active--;
        pending.delete(page);
        resolve(result);
      };
      pending.set(page, settle);
      signal.addEventListener("abort", () =>
        settle({ kind: "error", failure: { ...failure, kind: "aborted", status: null } })
      );
    });

  return {
    fetchPage,
    requested,
    maxActive: () => maxActive,
    resolve: async (page: number, result: Result) => {
      const settle = pending.get(page);
      if (!settle) {
        throw new Error(`page ${page} is not in flight`);
      }
      settle(result);
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

function start(fetcher: ReturnType<typeof controlledFetcher>, from: number, to: number, concurrency = 3) {
  const commits: number[] = [];
  const controller = new AbortController();
  const outcome = runPageRange<Item>({
    from,
    to,
    concurrency,
    fetchPage: fetcher.fetchPage,
    onCommit: (commit: PageCommit<Item>) => commits.push(commit.page),
    signal: controller.signal,
  });
  return { commits, controller, outcome };
}

describe("runPageRange", () => {
  it("commits out-of-order responses in page order", async () => {
    const fetcher = controlledFetcher();
    const run = start(fetcher, 6, 8);

    await fetcher.resolve(8, itemsFor(8));
    await fetcher.resolve(7, itemsFor(7));
    expect(run.commits).toEqual([]);

    await fetcher.resolve(6, itemsFor(6));
    expect(run.commits).toEqual([6, 7, 8]);
    await expect(run.outcome).resolves.toEqual({ status: "done", committedThrough: 8 });
  });

  it("never has more than `concurrency` requests in flight", async () => {
    const fetcher = controlledFetcher();
    const run = start(fetcher, 1, 6, 2);

    expect(fetcher.requested).toEqual([1, 2]);
    await fetcher.resolve(2, itemsFor(2));
    expect(fetcher.requested).toEqual([1, 2, 3]);
    for (const page of [1, 3, 4, 5, 6]) {
      await fetcher.resolve(page, itemsFor(page));
    }

    await run.outcome;
    expect(fetcher.maxActive()).toBe(2);
    expect(run.commits).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("keeps going past short and empty pages", async () => {
    const fetcher = controlledFetcher();
    const run = start(fetcher, 1, 3);

    await fetcher.resolve(1, itemsFor(1, 1));
    await fetcher.resolve(2, itemsFor(2, 0));
    await fetcher.resolve(3, itemsFor(3));

    await expect(run.outcome).resolves.toEqual({ status: "done", committedThrough: 3 });
    expect(run.commits).toEqual([1, 2, 3]);
  });

  it("ends at a past-the-end page and cancels pages fetched beyond it", async () => {
    const fetcher = controlledFetcher();
    const run = start(fetcher, 1, 10);

    await fetcher.resolve(3, itemsFor(3));
    await fetcher.resolve(2, { kind: "end" });
    await fetcher.resolve(1, itemsFor(1));

    // Page 4 started when page 3 finished; finding the end cancels it.
    await expect(run.outcome).resolves.toEqual({ status: "ended", committedThrough: 1 });
    expect(run.commits).toEqual([1]);
    expect(fetcher.requested).toEqual([1, 2, 3, 4]);
  });

  it("treats a past-the-end response as the end of the collection", async () => {
    const fetcher = controlledFetcher();
    const run = start(fetcher, 1, 5, 1);

    await fetcher.resolve(1, itemsFor(1));
    await fetcher.resolve(2, { kind: "end" });

    await expect(run.outcome).resolves.toEqual({ status: "ended", committedThrough: 1 });
  });

  it("on failure, stops scheduling, lets in-flight pages finish and commits the prefix", async () => {
    const fetcher = controlledFetcher();
    const run = start(fetcher, 1, 10);

    await fetcher.resolve(2, { kind: "error", failure });
    expect(fetcher.requested).toEqual([1, 2, 3]);

    await fetcher.resolve(3, itemsFor(3));
    await fetcher.resolve(1, itemsFor(1));

    await expect(run.outcome).resolves.toEqual({
      status: "failed",
      committedThrough: 1,
      failedPage: 2,
      failure,
    });
    expect(run.commits).toEqual([1]);
  });

  it("ignores a failure on a page past the end of the collection", async () => {
    const fetcher = controlledFetcher();
    const run = start(fetcher, 1, 10, 2);

    await fetcher.resolve(2, { kind: "error", failure });
    await fetcher.resolve(1, { kind: "end" });

    await expect(run.outcome).resolves.toEqual({ status: "ended", committedThrough: 0 });
  });

  it("reports what was committed when aborted from outside", async () => {
    const fetcher = controlledFetcher();
    const run = start(fetcher, 1, 10, 2);

    await fetcher.resolve(1, itemsFor(1));
    await fetcher.resolve(3, itemsFor(3));
    run.controller.abort();

    await expect(run.outcome).resolves.toEqual({ status: "aborted", committedThrough: 1 });
    expect(run.commits).toEqual([1]);
  });
});

describe("mergeUnique", () => {
  it("drops ids already seen across calls and counts them", () => {
    const seen = new Set<number>();
    expect(mergeUnique(seen, [{ id: 1 }, { id: 2 }])).toEqual({ kept: [{ id: 1 }, { id: 2 }], duplicates: 0 });
    expect(mergeUnique(seen, [{ id: 2 }, { id: 3 }, { id: 3 }])).toEqual({ kept: [{ id: 3 }], duplicates: 2 });
  });

  it("keeps items without a numeric id", () => {
    const seen = new Set<number>();
    expect(mergeUnique(seen, [{ slug: "a" }, { slug: "a" }]).kept).toHaveLength(2);
  });
});

describe("getBulkActions", () => {
  it.each([
    [190, 200, { next10: false, all: 10 }],
    [189, 200, { next10: true, all: 11 }],
    [199, 200, { next10: false, all: 1 }],
    [200, 200, { next10: false, all: null }],
  ])("after page %i of %i offers %j", (lastLoaded, total, expected) => {
    expect(getBulkActions(lastLoaded, total, true)).toEqual(expected);
  });

  it("offers only +10 when the total is unknown and the collection may continue", () => {
    expect(getBulkActions(5, null, true)).toEqual({ next10: true, all: null });
    expect(getBulkActions(5, null, false)).toEqual({ next10: false, all: null });
  });
});

describe("planBulkTarget", () => {
  it("caps +10 at the last page", () => {
    expect(planBulkTarget(5, 200, "next10")).toBe(15);
    expect(planBulkTarget(195, 200, "next10")).toBe(200);
    expect(planBulkTarget(5, null, "next10")).toBe(15);
  });

  it("targets the last page for load all", () => {
    expect(planBulkTarget(5, 200, "all")).toBe(200);
  });
});
