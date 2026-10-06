import type { HttpFailure } from "@/lib/http";

export type PageFetchResult<T> =
  | { kind: "items"; items: T[]; totalPages: number | null; totalRecords: number | null }
  /** The page is past the end of the collection (400 rest_post_invalid_page_number). */
  | { kind: "end" }
  | { kind: "error"; failure: HttpFailure };

export interface PageCommit<T> {
  page: number;
  items: T[];
  totalPages: number | null;
  totalRecords: number | null;
}

export interface PageRangeOptions<T> {
  from: number;
  to: number;
  concurrency: number;
  fetchPage: (page: number, signal: AbortSignal) => Promise<PageFetchResult<T>>;
  /** Called synchronously, strictly in page order, with no gaps. */
  onCommit: (commit: PageCommit<T>) => void;
  signal: AbortSignal;
}

export type PageRangeOutcome =
  | { status: "done"; committedThrough: number }
  /** The collection ran out before `to`. */
  | { status: "ended"; committedThrough: number }
  | { status: "aborted"; committedThrough: number }
  | { status: "failed"; committedThrough: number; failedPage: number; failure: HttpFailure };

/**
 * Fetches pages `from..to` with at most `concurrency` requests in flight and
 * commits them in order: a page that finishes early waits for the pages before
 * it. A failure stops scheduling; in-flight pages finish, and everything before
 * the failed page is committed. Finding the end cancels in-flight pages past it.
 */
export async function runPageRange<T>(options: PageRangeOptions<T>): Promise<PageRangeOutcome> {
  const { from, to, concurrency, fetchPage, onCommit, signal } = options;

  const buffer = new Map<number, PageCommit<T>>();
  let nextPage = from;
  let committedThrough = from - 1;
  // Last page that exists, once an empty page or past-the-end error reveals it.
  let lastPage = Number.POSITIVE_INFINITY;
  type Failed = { page: number; failure: HttpFailure };
  let failed: Failed | null = null;
  let anyFailed = false;
  const inFlight = new Map<number, AbortController>();
  signal.addEventListener("abort", () => inFlight.forEach((controller) => controller.abort()), {
    once: true,
  });

  const endAt = (page: number) => {
    lastPage = Math.min(lastPage, page);
    for (const [inFlightPage, controller] of inFlight) {
      if (inFlightPage > lastPage) {
        controller.abort();
      }
    }
  };

  const flush = () => {
    while (committedThrough < lastPage) {
      const commit = buffer.get(committedThrough + 1);
      if (!commit) {
        return;
      }
      buffer.delete(commit.page);
      committedThrough = commit.page;
      onCommit(commit);
    }
  };

  const worker = async () => {
    while (!signal.aborted && !anyFailed && nextPage <= to && nextPage <= lastPage) {
      const page = nextPage++;
      const controller = new AbortController();
      inFlight.set(page, controller);
      const result = await fetchPage(page, controller.signal);
      inFlight.delete(page);

      if (signal.aborted) {
        return;
      }
      if (page > lastPage) {
        continue;
      }

      if (result.kind === "error") {
        if (!failed || page < failed.page) {
          failed = { page, failure: result.failure };
        }
        anyFailed = true;
        continue;
      }

      // Not a short page: WordPress drops unreadable items after the query, so
      // pages in the middle of a collection can come back short.
      if (result.kind === "end" || result.items.length === 0) {
        endAt(page - 1);
      } else {
        buffer.set(page, { page, ...result });
      }
      flush();
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

  if (signal.aborted) {
    return { status: "aborted", committedThrough };
  }
  // A failure past the end of the collection doesn't matter.
  // Assigned inside the workers, which TypeScript's narrowing can't see.
  const firstFailure = failed as Failed | null;
  if (firstFailure && firstFailure.page <= lastPage) {
    return { status: "failed", committedThrough, failedPage: firstFailure.page, failure: firstFailure.failure };
  }
  if (lastPage < to) {
    return { status: "ended", committedThrough };
  }
  return { status: "done", committedThrough };
}

/** Drops items whose numeric `id` is already in `seen`; adds the rest to it. */
export function mergeUnique<T>(seen: Set<number>, items: T[]): { kept: T[]; duplicates: number } {
  const kept: T[] = [];
  let duplicates = 0;
  for (const item of items) {
    const id = item && typeof item === "object" ? (item as { id?: unknown }).id : undefined;
    if (typeof id === "number") {
      if (seen.has(id)) {
        duplicates++;
        continue;
      }
      seen.add(id);
    }
    kept.push(item);
  }
  return { kept, duplicates };
}

export type BulkKind = "next10" | "all";

export const BULK_STEP = 10;

/**
 * Which bulk actions to offer after `lastLoaded`. "+10" only when more than 10
 * pages remain; "Load all" needs a known total. With an unknown total only "+10"
 * is offered, and only while the collection may continue.
 */
export function getBulkActions(
  lastLoaded: number,
  totalPages: number | null,
  mayContinue: boolean
): { next10: boolean; all: number | null } {
  if (totalPages === null) {
    return { next10: mayContinue, all: null };
  }
  const remaining = Math.max(totalPages - lastLoaded, 0);
  return { next10: remaining > BULK_STEP, all: remaining > 0 ? remaining : null };
}

export function planBulkTarget(lastLoaded: number, totalPages: number | null, kind: BulkKind): number {
  if (kind === "all") {
    return totalPages ?? lastLoaded;
  }
  const target = lastLoaded + BULK_STEP;
  return totalPages === null ? target : Math.min(target, totalPages);
}
