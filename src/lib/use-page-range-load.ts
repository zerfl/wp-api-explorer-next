"use client";

import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { PAGE_RANGE_CONCURRENCY } from "@/lib/explorer";
import {
  buildCollectionUrl,
  extractWpErrorMessage,
  ResponseMetrics,
  SiteConnection,
} from "@/lib/explorer-client";
import type { HttpFailure, HttpResult, HttpSuccess } from "@/lib/http";
import { BulkKind, mergeUnique, PageFetchResult, planBulkTarget, runPageRange } from "@/lib/page-range";
import type { RequestGuard } from "@/lib/use-request-guard";
import { isInvalidPageNumber } from "@/lib/windowed-walk";
import type { WpRouteInfo } from "@/lib/wp-schema";

/** How often appended pages are pushed to React state during a run. */
const FLUSH_INTERVAL_MS = 750;

export interface BulkLoadState {
  status: "running" | "stopped" | "failed" | "done";
  firstPage: number;
  lastLoadedPage: number;
  /** First and last page of the current or most recent run. */
  runFrom: number;
  runTo: number;
  itemsLoaded: number;
  duplicatesSkipped: number;
  /** The collection ran out before the target page. */
  endedEarly: boolean;
  /** False once the end of the collection is known to be reached. */
  mayContinue: boolean;
  error: string | null;
  failedPage: number | null;
}

export interface LoadedRequest {
  conn: SiteConnection;
  route: WpRouteInfo;
  params: Record<string, string>;
}

type FetchJson = (
  conn: SiteConnection,
  targetUrl: string,
  signal?: AbortSignal,
  options?: { timeoutMs?: number; retries?: number }
) => Promise<HttpResult>;

interface Session {
  request: LoadedRequest;
  firstPage: number;
  lastLoadedPage: number;
  totalPages: number | null;
  /** Seeded from the first page on the first run. */
  seen: Set<number> | null;
  itemsLoaded: number;
  duplicatesSkipped: number;
  mayContinue: boolean;
  retryTarget: number | null;
}

function badResponse(result: HttpSuccess, message: string): HttpFailure {
  return {
    ok: false,
    kind: "http",
    status: result.status,
    statusText: result.statusText,
    message,
    body: null,
    headers: result.headers,
  };
}

function headerInt(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  return value ? Number.parseInt(value, 10) : null;
}

/**
 * Appends further pages of the displayed collection ("+10 pages" / "Load all
 * remaining"). Each run takes a request-guard ticket, so any navigation
 * supersedes it; Stop aborts it but keeps what was loaded.
 */
export function usePageRangeLoad({
  fetchJson,
  requestGuard,
  setResponseData,
  setMetrics,
}: {
  fetchJson: FetchJson;
  requestGuard: RequestGuard;
  setResponseData: React.Dispatch<React.SetStateAction<unknown>>;
  setMetrics: React.Dispatch<React.SetStateAction<ResponseMetrics | null>>;
}) {
  const [bulkLoad, setBulkLoad] = useState<BulkLoadState | null>(null);
  const sessionRef = useRef<Session | null>(null);

  /** Call whenever a new single-page request starts; null when the view can't be extended. */
  const track = useCallback((request: LoadedRequest | null) => {
    sessionRef.current = request
      ? {
          request,
          firstPage: Number(request.params.page) || 1,
          lastLoadedPage: Number(request.params.page) || 1,
          totalPages: null,
          seen: null,
          itemsLoaded: 0,
          duplicatesSkipped: 0,
          mayContinue: true,
          retryTarget: null,
        }
      : null;
    setBulkLoad(null);
  }, []);

  const run = useCallback(
    async (session: Session, from: number, to: number) => {
      const { conn, route, params } = session.request;
      const { signal, isCurrent } = requestGuard.begin();

      let pending: unknown[] = [];
      let totals: Pick<ResponseMetrics, "totalPages" | "totalRecords"> | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const snapshot = (
        status: BulkLoadState["status"],
        extra: Partial<BulkLoadState> = {}
      ): BulkLoadState => ({
        status,
        firstPage: session.firstPage,
        lastLoadedPage: session.lastLoadedPage,
        runFrom: from,
        runTo: to,
        itemsLoaded: session.itemsLoaded,
        duplicatesSkipped: session.duplicatesSkipped,
        endedEarly: false,
        mayContinue: session.mayContinue,
        error: null,
        failedPage: null,
        ...extra,
      });

      const publish = (state: BulkLoadState) => {
        if (!isCurrent()) {
          return;
        }
        if (pending.length) {
          const appended = pending;
          pending = [];
          setResponseData((prev: unknown) => (Array.isArray(prev) ? [...prev, ...appended] : appended));
        }
        if (totals) {
          const latest = totals;
          totals = null;
          setMetrics((prev) => (prev ? { ...prev, ...latest } : prev));
        }
        setBulkLoad(state);
      };

      const fetchPage = async (page: number, pageSignal: AbortSignal): Promise<PageFetchResult<unknown>> => {
        const url = buildCollectionUrl(conn.apiRoot, route.path, { ...params, page: String(page) });
        const result = await fetchJson(conn, url, pageSignal, { retries: 2 });
        if (!result.ok) {
          if (result.kind === "http" && result.status === 400 && isInvalidPageNumber(result.body)) {
            return { kind: "end" };
          }
          return { kind: "error", failure: result };
        }

        let json: unknown;
        try {
          json = JSON.parse(result.text);
        } catch {
          return { kind: "error", failure: badResponse(result, "Invalid JSON response.") };
        }
        if (!Array.isArray(json)) {
          return { kind: "error", failure: badResponse(result, "Expected a list of items.") };
        }
        return {
          kind: "items",
          items: json,
          totalPages: headerInt(result.headers, "x-wp-totalpages"),
          totalRecords: headerInt(result.headers, "x-wp-total"),
        };
      };

      setBulkLoad(snapshot("running"));

      const seen = session.seen ?? new Set<number>();
      const outcome = await runPageRange<unknown>({
        from,
        to,
        concurrency: PAGE_RANGE_CONCURRENCY,
        fetchPage,
        signal,
        onCommit: (commit) => {
          const { kept, duplicates } = mergeUnique(seen, commit.items);
          pending.push(...kept);
          session.itemsLoaded += kept.length;
          session.duplicatesSkipped += duplicates;
          session.lastLoadedPage = commit.page;
          if (commit.totalPages !== null) {
            session.totalPages = commit.totalPages;
            totals = { totalPages: commit.totalPages, totalRecords: commit.totalRecords };
          }
          timer ??= setTimeout(() => {
            timer = null;
            publish(snapshot("running"));
          }, FLUSH_INTERVAL_MS);
        },
      });

      if (timer) {
        clearTimeout(timer);
      }

      switch (outcome.status) {
        case "done":
          session.retryTarget = null;
          publish(snapshot("done"));
          break;
        case "ended":
          session.retryTarget = null;
          session.mayContinue = false;
          publish(snapshot("done", { endedEarly: true, mayContinue: false }));
          break;
        case "aborted":
          publish(snapshot("stopped"));
          break;
        case "failed": {
          session.retryTarget = to;
          const { failure } = outcome;
          const message =
            failure.kind === "http" ? extractWpErrorMessage(failure.body) ?? failure.message : failure.message;
          publish(snapshot("failed", { error: message, failedPage: outcome.failedPage }));
          break;
        }
      }
    },
    [fetchJson, requestGuard, setMetrics, setResponseData]
  );

  /** `items` and `totalPages` describe the single page currently shown. */
  const load = useCallback(
    async (kind: BulkKind, items: unknown[], totalPages: number | null) => {
      const session = sessionRef.current;
      if (!session) {
        return;
      }

      if (!session.seen) {
        session.seen = new Set();
        mergeUnique(session.seen, items);
        session.itemsLoaded = items.length;
        session.totalPages = totalPages;
      }

      const from = session.lastLoadedPage + 1;
      const to = planBulkTarget(session.lastLoadedPage, session.totalPages, kind);
      if (to >= from) {
        await run(session, from, to);
      }
    },
    [run]
  );

  const retry = useCallback(async () => {
    const session = sessionRef.current;
    if (session?.retryTarget) {
      await run(session, session.lastLoadedPage + 1, session.retryTarget);
    }
  }, [run]);

  const stop = useCallback(() => {
    requestGuard.abortCurrent();
  }, [requestGuard]);

  return useMemo(
    () => ({ bulkLoad, track, load, retry, stop }),
    [bulkLoad, load, retry, stop, track]
  );
}
