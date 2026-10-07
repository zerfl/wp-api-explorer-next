"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useInView } from "@/lib/use-in-view";
import QueryBuilder from "@/components/QueryBuilder";
import RequestConsole from "@/components/RequestConsole";
import VisualReader from "@/components/VisualReader";
import DataTable from "@/components/DataTable";
import JsonViewer from "@/components/JsonViewer";
import { useExplorer } from "@/contexts/ExplorerContext";
import { useRequest } from "@/contexts/RequestContext";
import { isMediaRoute, supportsDateWindows } from "@/lib/explorer-client";
import type { WalkEvent } from "@/lib/windowed-walk";
import { getBulkActions } from "@/lib/page-range";
import { buildUrlList, downloadTextFile, urlListFilename } from "@/lib/url-export";
import { BulkLoadDock, BulkLoadStatus } from "@/components/BulkLoadStatus";
import { Pagination, PaginationProps } from "@/components/Pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  Code as CodeIcon,
  Database,
  Loader2,
  Search,
  ShieldAlert,
} from "lucide-react";

function formatWalkEvent(event: WalkEvent): string {
  switch (event.type) {
    case "probe":
      return "probe: 1-day window ok";
    case "window":
      return `${event.after.slice(0, 10)} → ${event.before.slice(0, 10)} · ${event.spanDays} d · ${event.itemCount} items · ${event.pages} pages`;
    case "halved":
      return `${event.after.slice(0, 10)} → ${event.before.slice(0, 10)} · ${event.spanDays} d · too slow, halving to ${event.nextSpanDays} d`;
    case "unavailable":
      return `${event.after.slice(0, 10)} → ${event.before.slice(0, 10)} · no response, giving up`;
    default:
      return "";
  }
}

function ContentExplorerComponent() {
  const [showDevConsole, setShowDevConsole] = useState(false);
  const {
    state: { connection, selectedRoute, isAdvancedMode },
    actions: { syncCurrentBookmark },
    meta: { selectedCollection, getRouteLabel },
  } = useExplorer();
  const {
    state: {
      queryParams,
      isLoading,
      responseData,
      requestError,
      requestFailure,
      metrics,
      windowedMode,
      windowProgress,
      bulkLoad,
    },
    actions: {
      setQueryParams,
      executeCurrentRequest,
      changePerPage,
      setWindowedMode,
      stopWindowedWalk,
      loadMorePages,
      retryBulkLoad,
      stopBulkLoad,
      exitBulkLoad,
    },
  } = useRequest();

  // Appended cards push the bottom pager far down, so a run started there would
  // otherwise leave no visible progress.
  const [statusRef, statusInView] = useInView<HTMLDivElement>();
  const [bottomPagerRef, bottomPagerInView] = useInView<HTMLDivElement>();
  const showDock = bulkLoad?.status === "running" && !statusInView && !bottomPagerInView;

  const routeSupportsWindows = selectedRoute ? supportsDateWindows(selectedRoute) : false;
  const showWindowedResume =
    routeSupportsWindows &&
    !windowedMode &&
    !!requestFailure &&
    (requestFailure.kind === "timeout" ||
      (requestFailure.kind === "http" && (requestFailure.status ?? 0) >= 500));

  const handlePageChange = (page: number) => {
    const nextParams = { ...queryParams, page: String(page) };
    setQueryParams(nextParams);
    syncCurrentBookmark(String(page), "push");
    void executeCurrentRequest(nextParams);
  };

  // Debounced auto-search: only fires for genuine keystrokes, never when the
  // search term is reset programmatically (e.g. switching collections), so it
  // can't double-fetch. The request race guard makes rapid typing safe.
  const searchTerm = queryParams.search || "";
  const debouncedSearch = useDebouncedValue(searchTerm, 400);
  const lastSearchedRef = useRef(searchTerm);
  const userTypedRef = useRef(false);

  const runSearch = useCallback(() => {
    lastSearchedRef.current = queryParams.search || "";
    userTypedRef.current = false;
    syncCurrentBookmark(queryParams.page || "1", "push");
    void executeCurrentRequest();
  }, [executeCurrentRequest, queryParams.page, queryParams.search, syncCurrentBookmark]);

  useEffect(() => {
    if (debouncedSearch === lastSearchedRef.current) {
      return;
    }
    lastSearchedRef.current = debouncedSearch;
    if (!userTypedRef.current) {
      return;
    }
    userTypedRef.current = false;
    void executeCurrentRequest();
  }, [debouncedSearch, executeCurrentRequest]);

  const isSelectedMediaRoute = selectedRoute ? isMediaRoute(selectedRoute.path) : false;

  const resultItems = Array.isArray(responseData) ? responseData : null;
  const resultCount = resultItems ? resultItems.length : responseData ? 1 : 0;
  const currentPageNumber = Number.parseInt(queryParams.page || "1", 10);
  const resultLabel = selectedRoute ? getRouteLabel(selectedRoute).toLowerCase() : "items";
  const totalPages = metrics?.totalPages ?? null;
  const lastShownPage = bulkLoad?.lastLoadedPage ?? currentPageNumber;
  const resultAnnouncement = bulkLoad
    ? ""
    : `Loaded ${resultCount} ${resultLabel} on page ${currentPageNumber}${totalPages ? ` of ${totalPages}` : ""}.`;

  // Only matters without a total. A short or even empty page isn't the end
  // (see page-range.ts); only a past-the-end 400 during a run is.
  const mayContinue = bulkLoad ? bulkLoad.mayContinue : true;
  const bulkActions =
    !windowedMode && resultItems && resultItems.length > 0
      ? getBulkActions(lastShownPage, totalPages, mayContinue)
      : null;

  const downloadUrls =
    connection && selectedRoute && resultItems && resultItems.length > 0
      ? () => {
          const typeSlug = selectedCollection?.slug ?? selectedRoute.path.split("/").pop() ?? "items";
          downloadTextFile(
            urlListFilename(connection.siteUrl, typeSlug, currentPageNumber, lastShownPage),
            buildUrlList(resultItems, selectedRoute.path)
          );
        }
      : null;

  const paginationProps: PaginationProps = {
    currentPage: currentPageNumber,
    lastShown: lastShownPage,
    totalPages,
    isLoading,
    hasNextPage: windowedMode ? windowProgress?.hasMore ?? true : mayContinue,
    onPageChange: handlePageChange,
    bulkLoad,
    bulkActions,
    onLoadMore: (kind) => void loadMorePages(kind),
    onStop: stopBulkLoad,
    onRetry: () => void retryBulkLoad(),
    onExit: () => void exitBulkLoad(),
    onDownload: downloadUrls,
  };

  if (!connection) {
    return null;
  }

  return (
    <div className="space-y-5">
      {selectedRoute ? (
        isAdvancedMode ? (
          <>
            <RequestConsole />
            <QueryBuilder route={selectedRoute} />
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card/20 p-4 backdrop-blur-md shadow-sm">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Exploring
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {selectedCollection?.label || getRouteLabel(selectedRoute)}
                  </h3>
                  {windowedMode ? (
                    <p className="text-sm text-muted-foreground">
                      Date-window listing · batch {windowProgress?.batch ?? currentPageNumber} ·{" "}
                      {windowProgress?.itemsCollected ?? 0} items collected
                      {windowProgress?.walkedTo ? ` · walked to ${windowProgress.walkedTo.slice(0, 10)}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {routeSupportsWindows ? (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Switch
                        checked={windowedMode}
                        onCheckedChange={(checked) => setWindowedMode(checked)}
                        aria-label="Load in date windows"
                      />
                      <span>Load in date windows</span>
                    </label>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Show</span>
                    <Select
                      value={queryParams.per_page || "100"}
                      onValueChange={(value) => {
                        void changePerPage(value);
                      }}
                    >
                      <SelectTrigger aria-label="Items per page" className="h-10 w-20 bg-background/60 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Pagination {...paginationProps} />
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className={`grid gap-3 ${isSelectedMediaRoute ? "xl:grid-cols-4" : ""}`}>
                  <div className={`relative ${isSelectedMediaRoute ? "xl:col-span-1" : ""}`}>
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      type="text"
                      placeholder={`Search ${getRouteLabel(selectedRoute).toLowerCase()}...`}
                      aria-label={`Search ${getRouteLabel(selectedRoute).toLowerCase()}`}
                      value={queryParams.search || ""}
                      onChange={(event) => {
                        userTypedRef.current = true;
                        setQueryParams((current) => ({
                          ...current,
                          search: event.target.value,
                          page: "1",
                        }));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          runSearch();
                        }
                      }}
                      className="h-10 bg-background/60 pl-9 text-sm"
                    />
                  </div>

                  {isSelectedMediaRoute ? (
                    <>
                      <Select
                        value={queryParams.media_type || "ALL"}
                        onValueChange={(value) => {
                          setQueryParams((current) => {
                            const nextParams: Record<string, string> = { ...current, page: "1" };
                            if (!value || value === "ALL") {
                              delete nextParams.media_type;
                            } else {
                              nextParams.media_type = value;
                            }
                            return nextParams;
                          });
                        }}
                      >
                        <SelectTrigger aria-label="Media type" className="h-10 bg-background/60 text-sm">
                          <SelectValue placeholder="Media type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All media</SelectItem>
                          <SelectItem value="image">Images</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="audio">Audio</SelectItem>
                          <SelectItem value="application">Applications</SelectItem>
                          <SelectItem value="text">Text</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        type="text"
                        placeholder="MIME type, e.g. image/jpeg"
                        aria-label="MIME type filter"
                        value={queryParams.mime_type || ""}
                        onChange={(event) => {
                          setQueryParams((current) => ({
                            ...current,
                            mime_type: event.target.value,
                            page: "1",
                          }));
                        }}
                        className="h-10 bg-background/60 text-sm"
                      />

                      <Input
                        type="number"
                        placeholder="Parent post ID"
                        aria-label="Parent post ID filter"
                        value={queryParams.parent || ""}
                        onChange={(event) => {
                          setQueryParams((current) => ({
                            ...current,
                            parent: event.target.value,
                            page: "1",
                          }));
                        }}
                        className="h-10 bg-background/60 text-sm"
                      />
                    </>
                  ) : null}
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={runSearch}
                    disabled={isLoading}
                    className="h-10 text-sm"
                  >
                    Search
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/30 bg-card/10 p-3">
              <button
                type="button"
                onClick={() => setShowDevConsole((current) => !current)}
                aria-expanded={showDevConsole}
                aria-controls="developer-tools-panel"
                className="flex w-full items-center justify-between text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <CodeIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                  Developer tools
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showDevConsole ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {showDevConsole ? (
                <div id="developer-tools-panel" className="mt-3 border-t border-border/20 pt-3">
                  <RequestConsole />
                </div>
              ) : null}
            </div>
          </div>
        )
      ) : null}

      {isLoading ? (
        windowedMode ? (
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="flex flex-col gap-3 rounded-xl border border-border/30 bg-card/5 p-5"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
              <span className="text-base font-semibold text-foreground">
                Walking the library in date windows…
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Batch {windowProgress?.batch ?? currentPageNumber} · {windowProgress?.itemsCollected ?? 0} items collected
            </p>
            {windowProgress && windowProgress.log.length > 0 ? (
              <div className="max-h-48 overflow-auto rounded-lg border border-border/20 bg-background/40 p-3">
                <ul className="space-y-1">
                  {windowProgress.log.map((event, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      {formatWalkEvent(event)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <Button variant="outline" className="text-sm" onClick={stopWindowedWalk}>
                Stop
              </Button>
            </div>
          </div>
        ) : (
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/30 bg-card/5 py-20"
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold text-muted-foreground">Loading content items…</span>
          </div>
        )
      ) : null}

      {bulkLoad ? (
        <div ref={statusRef}>
          <BulkLoadStatus bulkLoad={bulkLoad} />
        </div>
      ) : null}

      {requestError ? (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <h4 className="text-base font-semibold">Fetch request failed</h4>
            <p>{requestError}</p>
            {windowedMode ? (
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="text-sm"
                  onClick={() => void executeCurrentRequest()}
                >
                  Retry
                </Button>
              </div>
            ) : null}
            {showWindowedResume ? (
              <div className="space-y-2 pt-2">
                <p>The site answers narrow date ranges even when the full list times out.</p>
                <Button
                  variant="outline"
                  className="text-sm"
                  onClick={() => setWindowedMode(true)}
                >
                  Load in date windows
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {responseData && !isLoading ? (
        <div className="space-y-3">
          <p className="sr-only" role="status" aria-live="polite">
            {resultAnnouncement}
          </p>
          <Tabs defaultValue="visual" className="w-full">
            <div className="mb-3 flex items-center justify-between border-b border-border/20 pb-1.5">
              <h3 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                <Database className="h-4 w-4 text-primary" aria-hidden="true" />
                WordPress content payload
              </h3>
              <TabsList className="h-9 bg-background/50 p-0.5">
                <TabsTrigger value="visual" className="text-sm">
                  Visual view
                </TabsTrigger>
                <TabsTrigger value="table" className="text-sm">
                  Data grid
                </TabsTrigger>
                <TabsTrigger value="json" className="text-sm">
                  Raw JSON
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="visual" className="mt-0">
              <VisualReader data={responseData} routePath={selectedRoute?.path || ""} />
            </TabsContent>
            <TabsContent value="table" className="mt-0">
              <DataTable data={responseData} />
            </TabsContent>
            <TabsContent value="json" className="mt-0">
              {/* Expanding every item of a long list would render tens of thousands of nodes. */}
              <JsonViewer data={responseData} initialExpandDepth={resultCount > 200 ? 1 : 2} />
            </TabsContent>
          </Tabs>

          <div ref={bottomPagerRef} className="mt-6 flex justify-center border-t border-border/20 pb-8 pt-6">
            <Pagination {...paginationProps} />
          </div>
        </div>
      ) : null}

      {showDock && bulkLoad ? <BulkLoadDock bulkLoad={bulkLoad} onStop={stopBulkLoad} /> : null}
    </div>
  );
}

const ContentExplorer = memo(ContentExplorerComponent);

export default ContentExplorer;
