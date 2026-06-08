"use client";

import React, { useCallback, useEffect, useState } from "react";
import { QUICK_CONNECT_SITES } from "@/lib/constants";
import ExplorerProvider from "@/components/ExplorerProvider";
import ExplorerHeader from "@/components/ExplorerHeader";
import RouteNavigator from "@/components/RouteNavigator";
import QueryBuilder from "@/components/QueryBuilder";
import RequestConsole from "@/components/RequestConsole";
import VisualReader from "@/components/VisualReader";
import DataTable from "@/components/DataTable";
import JsonViewer from "@/components/JsonViewer";
import { THEME_STORAGE_KEY } from "@/lib/explorer";
import { applyTheme, ExplorerTheme, isMediaRoute } from "@/lib/explorer-client";
import { useExplorer } from "@/contexts/ExplorerContext";
import { useRequest } from "@/contexts/RequestContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code as CodeIcon,
  Database,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  MessageSquare,
  Search,
  ShieldAlert,
  Sparkles,
  Terminal,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ExplorerAppProps {
  initialPathname?: string;
}

export default function ExplorerApp({ initialPathname = "/" }: ExplorerAppProps) {
  const [theme, setTheme] = useState<ExplorerTheme>("system");

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ExplorerTheme | null;
    const initialTheme = savedTheme || "system";
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemePreferenceChange = () => {
      const currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || "system";
      if (currentTheme === "system") {
        applyTheme("system");
      }
    };

    const timeoutId = window.setTimeout(() => {
      setTheme(initialTheme);
      applyTheme(initialTheme);
    }, 0);

    mediaQuery.addEventListener("change", handleThemePreferenceChange);
    return () => {
      window.clearTimeout(timeoutId);
      mediaQuery.removeEventListener("change", handleThemePreferenceChange);
    };
  }, []);

  const handleThemeChange = useCallback((nextTheme: ExplorerTheme) => {
    setTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }, []);

  return (
    <ExplorerProvider initialPathname={initialPathname}>
      <div className="flex min-h-screen flex-col bg-background">
        <ExplorerHeader theme={theme} onThemeChange={handleThemeChange} />
        <ExplorerAppLayout />
      </div>
    </ExplorerProvider>
  );
}

function ExplorerAppLayout() {
  const [showDevConsole, setShowDevConsole] = useState(false);

  const {
    state: { connection, routes, selectedRoute, isAdvancedMode },
    actions: { connectToSite, navigateCollection, selectRoute, syncCurrentBookmark },
    meta: {
      selectedCollection,
      coreCollections,
      customCollections,
      getRouteLabel,
      bookmarkContentType,
    },
  } = useExplorer();
  const {
    state: { queryParams, isLoading, responseData, requestError, metrics },
    actions: { setQueryParams, executeCurrentRequest, changePerPage },
  } = useRequest();

  const isSelectedMediaRoute = selectedRoute ? isMediaRoute(selectedRoute.path) : false;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] min-h-0 flex-1">
      {connection ? (
        <aside className="hidden w-[280px] shrink-0 border-r border-border/40 bg-card/10 p-4 lg:block">
          {isAdvancedMode ? (
            <RouteNavigator
              routes={routes}
              selectedRoute={selectedRoute?.path || ""}
              onSelectRoute={selectRoute}
            />
          ) : (
            <div className="flex h-full flex-col gap-4 rounded-xl border border-border/40 bg-card/20 p-4 backdrop-blur-md">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Collections</h2>
                <p className="text-sm text-muted-foreground">
                  Built-in collections and registered custom post types.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Core
                  </div>
                  {coreCollections.map((collection) => {
                    const isActive = selectedCollection?.routePath === collection.routePath;
                    return (
                      <button
                        key={collection.routePath}
                        type="button"
                        onClick={() => {
                          void navigateCollection(collection);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                          isActive
                            ? "border-primary/25 bg-primary/10 font-semibold text-primary"
                            : "border-transparent text-muted-foreground hover:border-border/40 hover:bg-background/70 hover:text-foreground"
                        }`}
                      >
                        {collection.slug === "media" ? (
                          <ImageIcon className="h-4.5 w-4.5 shrink-0" />
                        ) : collection.slug === "pages" ? (
                          <Layers className="h-4.5 w-4.5 shrink-0" />
                        ) : collection.slug === "comments" ? (
                          <MessageSquare className="h-4.5 w-4.5 shrink-0" />
                        ) : collection.slug === "users" ? (
                          <User className="h-4.5 w-4.5 shrink-0" />
                        ) : (
                          <FileText className="h-4.5 w-4.5 shrink-0" />
                        )}
                        {collection.label}
                      </button>
                    );
                  })}
                </div>

                {customCollections.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Custom types
                    </div>
                    <ScrollArea className="h-[260px] pr-2">
                      <div className="space-y-1.5">
                        {customCollections.map((collection) => {
                          const isActive = selectedCollection?.routePath === collection.routePath;
                          return (
                            <button
                              key={collection.routePath}
                              type="button"
                              onClick={() => {
                                void navigateCollection(collection);
                              }}
                              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                                isActive
                                  ? "border-primary/25 bg-primary/10 font-semibold text-primary"
                                  : "border-transparent text-muted-foreground hover:border-border/40 hover:bg-background/70 hover:text-foreground"
                              }`}
                            >
                              <span>{collection.label}</span>
                              <span className="text-xs font-mono opacity-70">{collection.slug}</span>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </aside>
      ) : null}

      <main className="min-w-0 flex-1 overflow-y-auto bg-background/25 px-4 py-5 md:px-6">
        {!connection ? (
          <div className="flex min-h-[60vh] items-center justify-center py-8">
            <div className="max-w-3xl text-center">
              <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 shadow-inner">
                <Database className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Client-side WordPress Explorer
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Connect to any WordPress site, browse bookmarkable collection URLs, inspect media properly,
                and keep your preferred page size across sessions.
              </p>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <Card className="border-border bg-card/30 backdrop-blur-sm">
                  <CardContent className="space-y-2 p-5">
                    <Sparkles className="mx-auto h-5 w-5 text-primary" />
                    <h3 className="text-base font-semibold">Bookmarkable collections</h3>
                    <p className="text-sm text-muted-foreground">
                      Share direct paths such as `/site/example.com/media/2` and reconnect automatically.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card/30 backdrop-blur-sm">
                  <CardContent className="space-y-2 p-5">
                    <Terminal className="mx-auto h-5 w-5 text-primary" />
                    <h3 className="text-base font-semibold">Proxy when needed</h3>
                    <p className="text-sm text-muted-foreground">
                      Keep direct requests by default and route through the local proxy only when CORS blocks you.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card/30 backdrop-blur-sm">
                  <CardContent className="space-y-2 p-5">
                    <ImageIcon className="mx-auto h-5 w-5 text-primary" />
                    <h3 className="text-base font-semibold">Better media browsing</h3>
                    <p className="text-sm text-muted-foreground">
                      Preview images, video, audio, PDFs, and files with gallery navigation inside the modal.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Try an example
                </span>
                {QUICK_CONNECT_SITES.map((site) => (
                  <Button
                    key={site.name}
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void connectToSite({
                        siteUrl: site.url,
                        useProxy: site.defaultProxy,
                        auth: null,
                        desiredContentType: bookmarkContentType || undefined,
                        desiredPage: "1",
                        navigationMode: "replace",
                      });
                    }}
                    disabled={isLoading}
                    className="h-8 text-sm"
                    title={site.description}
                  >
                    {site.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
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
        )}
      </main>
    </div>
  );
}
