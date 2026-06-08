"use client";

import { memo, useState } from "react";
import QueryBuilder from "@/components/QueryBuilder";
import RequestConsole from "@/components/RequestConsole";
import VisualReader from "@/components/VisualReader";
import DataTable from "@/components/DataTable";
import JsonViewer from "@/components/JsonViewer";
import { useExplorer } from "@/contexts/ExplorerContext";
import { useRequest } from "@/contexts/RequestContext";
import { isMediaRoute } from "@/lib/explorer-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code as CodeIcon,
  Database,
  Loader2,
  Search,
  ShieldAlert,
} from "lucide-react";

function ContentExplorerComponent() {
  const [showDevConsole, setShowDevConsole] = useState(false);
  const {
    state: { connection, selectedRoute, isAdvancedMode },
    actions: { syncCurrentBookmark },
    meta: { selectedCollection, getRouteLabel },
  } = useExplorer();
  const {
    state: { queryParams, isLoading, responseData, requestError, metrics },
    actions: { setQueryParams, executeCurrentRequest, changePerPage },
  } = useRequest();

  if (!connection) {
    return null;
  }

  const isSelectedMediaRoute = selectedRoute ? isMediaRoute(selectedRoute.path) : false;

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
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Show</span>
                    <Select
                      value={queryParams.per_page || "100"}
                      onValueChange={(value) => {
                        void changePerPage(value);
                      }}
                    >
                      <SelectTrigger className="h-10 w-20 bg-background/60 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 border-l border-border/30 pl-3">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={isLoading || Number.parseInt(queryParams.page || "1", 10) <= 1}
                      onClick={() => {
                        const previousPage = Math.max(1, Number.parseInt(queryParams.page || "1", 10) - 1);
                        const nextParams = { ...queryParams, page: String(previousPage) };
                        setQueryParams(nextParams);
                        syncCurrentBookmark(String(previousPage), "push");
                        void executeCurrentRequest(nextParams);
                      }}
                      className="h-10 w-10"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <span className="min-w-[92px] text-center text-sm font-semibold text-foreground/80">
                      Page {queryParams.page || "1"}
                      {metrics?.totalPages ? ` / ${metrics.totalPages}` : ""}
                    </span>

                    <Button
                      variant="outline"
                      size="icon"
                      disabled={
                        isLoading ||
                        (metrics?.totalPages !== null &&
                          Number.parseInt(queryParams.page || "1", 10) >= (metrics?.totalPages || 1))
                      }
                      onClick={() => {
                        const nextPage = Number.parseInt(queryParams.page || "1", 10) + 1;
                        const nextParams = { ...queryParams, page: String(nextPage) };
                        setQueryParams(nextParams);
                        syncCurrentBookmark(String(nextPage), "push");
                        void executeCurrentRequest(nextParams);
                      }}
                      className="h-10 w-10"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className={`grid gap-3 ${isSelectedMediaRoute ? "xl:grid-cols-4" : ""}`}>
                  <div className={`relative ${isSelectedMediaRoute ? "xl:col-span-1" : ""}`}>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={`Search ${getRouteLabel(selectedRoute).toLowerCase()}...`}
                      value={queryParams.search || ""}
                      onChange={(event) => {
                        setQueryParams((current) => ({
                          ...current,
                          search: event.target.value,
                          page: "1",
                        }));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void executeCurrentRequest();
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
                        <SelectTrigger className="h-10 bg-background/60 text-sm">
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
                    onClick={() => {
                      syncCurrentBookmark(queryParams.page || "1", "push");
                      void executeCurrentRequest();
                    }}
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
                className="flex w-full items-center justify-between text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <CodeIcon className="h-4 w-4 text-primary" />
                  Developer tools
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showDevConsole ? "rotate-180" : ""}`} />
              </button>

              {showDevConsole ? (
                <div className="mt-3 border-t border-border/20 pt-3">
                  <RequestConsole />
                </div>
              ) : null}
            </div>
          </div>
        )
      ) : null}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/30 bg-card/5 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm font-semibold text-muted-foreground">Loading content items...</span>
        </div>
      ) : null}

      {requestError ? (
        <div className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-base font-semibold">Fetch request failed</h4>
            <p>{requestError}</p>
          </div>
        </div>
      ) : null}

      {responseData && !isLoading ? (
        <div className="space-y-3">
          <Tabs defaultValue="visual" className="w-full">
            <div className="mb-3 flex items-center justify-between border-b border-border/20 pb-1.5">
              <h3 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                <Database className="h-4 w-4 text-primary" />
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
              <JsonViewer data={responseData} />
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </div>
  );
}

const ContentExplorer = memo(ContentExplorerComponent);

export default ContentExplorer;
