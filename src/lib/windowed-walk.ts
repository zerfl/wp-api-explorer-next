import type { HttpFailure, HttpResult } from "@/lib/http";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface WindowRequest {
  after: string;
  before: string;
  page: number;
  perPage: number;
}

export type FetchWindow = (request: WindowRequest, signal?: AbortSignal) => Promise<HttpResult>;

export interface WalkerOptions {
  perPage: number;
  start: string;
  end: string;
  initialWindowMs?: number;
  ceilingMs?: number;
  minWindowMs?: number;
}

export type WalkEvent =
  | { type: "probe"; ok: boolean }
  | {
      type: "window";
      after: string;
      before: string;
      spanDays: number;
      itemCount: number;
      pages: number;
    }
  | { type: "halved"; after: string; before: string; spanDays: number; nextSpanDays: number }
  | { type: "unavailable"; after: string; before: string };

export type WalkOutcome =
  | { status: "ok" }
  | { status: "unavailable" }
  | { status: "aborted" }
  | { status: "error"; failure: HttpFailure };

export interface WindowedWalker<T extends { id: number }> {
  collect(minItems: number, signal?: AbortSignal): Promise<WalkOutcome>;
  readonly items: T[];
  readonly done: boolean;
  readonly cursor: string;
}

/**
 * @param input a date the user typed or a bound to normalize
 * @return a zone-less `YYYY-MM-DDTHH:MM:SS` string, or null when the shape is unrecognized
 */
export function normalizeWpDate(input: string): string | null {
  const value = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return `${value}:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  return null;
}

/**
 * @param date the moment to render
 * @return local wall-clock time as `YYYY-MM-DDTHH:MM:SS` with no timezone, the form WordPress reads in the site's own timezone
 */
export function formatWpDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function parseLocalMs(value: string): number {
  return new Date(value).getTime();
}

function toDays(ms: number): number {
  return Math.round(ms / DAY_MS);
}

function invalidJsonFailure(): HttpFailure {
  return {
    ok: false,
    kind: "network",
    status: null,
    statusText: "",
    message: "The windowed response was not a JSON array.",
    body: null,
    headers: null,
  };
}

// A gateway 5xx page has no CORS headers, so in direct mode it reaches us as kind "network".
function isSlowSignal(failure: HttpFailure): boolean {
  return (
    failure.kind === "timeout" ||
    failure.kind === "network" ||
    (failure.kind === "http" && failure.status !== null && failure.status >= 500)
  );
}

function isInvalidPageNumber(body: string | null): boolean {
  if (!body) {
    return false;
  }
  try {
    const json: unknown = JSON.parse(body);
    return (
      !!json &&
      typeof json === "object" &&
      (json as Record<string, unknown>).code === "rest_post_invalid_page_number"
    );
  } catch {
    return false;
  }
}

export function createWindowedWalker<T extends { id: number }>(
  fetchWindow: FetchWindow,
  options: WalkerOptions,
  onEvent?: (event: WalkEvent) => void
): WindowedWalker<T> {
  const { perPage, start, end } = options;
  const initialWindowMs = options.initialWindowMs ?? 365 * DAY_MS;
  const minWindowMs = options.minWindowMs ?? DAY_MS;
  let ceilingMs = options.ceilingMs ?? 8 * 365 * DAY_MS;

  const endMs = parseLocalMs(end);

  const items: T[] = [];
  const seen = new Set<number>();
  let done = false;
  let probed = false;
  let after = start;
  let windowMs = initialWindowMs;
  let page = 1;
  let pagesFetched = 0;
  let windowItemCount = 0;

  const emit = (event: WalkEvent) => {
    if (onEvent) {
      onEvent(event);
    }
  };

  const finishWindow = (afterMs: number, beforeMs: number, before: string) => {
    emit({
      type: "window",
      after,
      before,
      spanDays: toDays(beforeMs - afterMs),
      itemCount: windowItemCount,
      pages: pagesFetched,
    });

    if (windowItemCount === 0) {
      windowMs = Math.min(windowMs * 2, ceilingMs);
    }

    const nextAfterMs = beforeMs - 1000;
    after = formatWpDate(new Date(nextAfterMs));
    page = 1;
    pagesFetched = 0;
    windowItemCount = 0;

    if (nextAfterMs >= endMs || beforeMs >= endMs) {
      done = true;
    }
  };

  const collect = async (minItems: number, signal?: AbortSignal): Promise<WalkOutcome> => {
    if (signal?.aborted) {
      return { status: "aborted" };
    }

    if (!probed) {
      const probeAfter = formatWpDate(new Date(endMs - DAY_MS));
      const result = await fetchWindow({ after: probeAfter, before: end, page: 1, perPage }, signal);
      if (signal?.aborted) {
        return { status: "aborted" };
      }
      if (!result.ok) {
        if (result.kind === "aborted") {
          return { status: "aborted" };
        }
        if (isSlowSignal(result)) {
          probed = true;
          emit({ type: "unavailable", after: probeAfter, before: end });
          return { status: "unavailable" };
        }
        probed = true;
        return { status: "error", failure: result };
      }
      probed = true;
      emit({ type: "probe", ok: true });
    }

    while (items.length < minItems && !done) {
      if (signal?.aborted) {
        return { status: "aborted" };
      }

      const afterMs = parseLocalMs(after);
      const beforeMs = Math.min(afterMs + windowMs, endMs);
      const before = formatWpDate(new Date(beforeMs));

      const result = await fetchWindow({ after, before, page, perPage }, signal);
      if (signal?.aborted) {
        return { status: "aborted" };
      }

      if (result.ok) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(result.text);
        } catch {
          return { status: "error", failure: invalidJsonFailure() };
        }
        if (!Array.isArray(parsed)) {
          return { status: "error", failure: invalidJsonFailure() };
        }

        const batch = parsed as T[];
        pagesFetched += 1;
        windowItemCount += batch.length;
        for (const item of batch) {
          if (item && typeof item.id === "number" && !seen.has(item.id)) {
            seen.add(item.id);
            items.push(item);
          }
        }

        const totalPagesHeader = result.headers.get("x-wp-totalpages");
        const totalPages = totalPagesHeader ? Number.parseInt(totalPagesHeader, 10) : null;
        const finished =
          batch.length < perPage || (totalPages !== null && page >= totalPages);

        if (finished) {
          finishWindow(afterMs, beforeMs, before);
        } else {
          page += 1;
        }
        continue;
      }

      if (result.kind === "aborted") {
        return { status: "aborted" };
      }

      if (result.kind === "http" && result.status === 400 && isInvalidPageNumber(result.body)) {
        finishWindow(afterMs, beforeMs, before);
        continue;
      }

      if (isSlowSignal(result)) {
        if (windowMs <= minWindowMs) {
          emit({ type: "unavailable", after, before });
          return { status: "unavailable" };
        }
        const nextWindowMs = Math.max(Math.floor(windowMs / 2), minWindowMs);
        emit({
          type: "halved",
          after,
          before,
          spanDays: toDays(windowMs),
          nextSpanDays: toDays(nextWindowMs),
        });
        windowMs = nextWindowMs;
        ceilingMs = windowMs;
        page = 1;
        pagesFetched = 0;
        windowItemCount = 0;
        continue;
      }

      return { status: "error", failure: result };
    }

    return { status: "ok" };
  };

  return {
    collect,
    get items() {
      return items;
    },
    get done() {
      return done;
    },
    get cursor() {
      return after;
    },
  };
}
