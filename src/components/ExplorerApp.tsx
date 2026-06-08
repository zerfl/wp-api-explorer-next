"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SiteSelector from "@/components/SiteSelector";
import RouteNavigator from "@/components/RouteNavigator";
import QueryBuilder from "@/components/QueryBuilder";
import RequestConsole from "@/components/RequestConsole";
import VisualReader from "@/components/VisualReader";
import DataTable from "@/components/DataTable";
import JsonViewer from "@/components/JsonViewer";
import {
  buildExplorerPath,
  CONNECTION_STORAGE_KEY,
  ContentCollection,
  DEFAULT_PER_PAGE,
  findCollectionByRoutePath,
  findCollectionBySlug,
  getCoreCollections,
  getCustomCollections,
  humanizeSegment,
  normalizeSiteUrl,
  parseExplorerPath,
  PER_PAGE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  WpTypeDefinition,
} from "@/lib/explorer";
import { WpRouteInfo, WpSchema, discoverWpApiRoot, parseWpSchema } from "@/lib/wp-schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code as CodeIcon,
  Database,
  ExternalLink,
  FileText,
  Globe,
  Image as ImageIcon,
  Laptop,
  Layers,
  Loader2,
  MessageSquare,
  Moon,
  Search,
  ShieldAlert,
  Sparkles,
  Sun,
  Terminal,
  Unlink,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SiteConnection {
  siteUrl: string;
  apiRoot: string;
  schema: WpSchema;
  useProxy: boolean;
  auth: { username: string; appPassword: string } | null;
}

interface StoredConnectionSnapshot {
  siteUrl: string;
  useProxy: boolean;
  auth: { username: string; appPassword: string } | null;
}

const applyTheme = (activeTheme: "light" | "dark" | "system") => {
  if (typeof window === "undefined") return;
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");

  let computedTheme: "light" | "dark" = "dark";
  if (activeTheme === "system") {
    const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    computedTheme = systemIsDark ? "dark" : "light";
  } else {
    computedTheme = activeTheme;
  }

  root.classList.add(computedTheme);
};

const getStoredPerPage = () => {
  if (typeof window === "undefined") {
    return DEFAULT_PER_PAGE;
  }

  return localStorage.getItem(PER_PAGE_STORAGE_KEY) || DEFAULT_PER_PAGE;
};

const getStoredConnection = (): StoredConnectionSnapshot | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(CONNECTION_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredConnectionSnapshot;
  } catch {
    return null;
  }
};

const persistConnection = (connection: StoredConnectionSnapshot | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!connection) {
    window.sessionStorage.removeItem(CONNECTION_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(connection));
};

const getRouteArgs = (route: WpRouteInfo | null) => route?.endpoints?.[0]?.args || {};

const buildBaseQueryParams = (
  route: WpRouteInfo,
  perPage: string,
  overrides: Record<string, string> = {}
): Record<string, string> => {
  const args = getRouteArgs(route);
  const params: Record<string, string> = {
    page: overrides.page || "1",
    per_page: overrides.per_page || perPage,
  };

  Object.entries(args).forEach(([key, schemaArg]) => {
    if (
      schemaArg.default === undefined ||
      schemaArg.default === null ||
      schemaArg.default === "" ||
      key in params
    ) {
      return;
    }

    params[key] = String(schemaArg.default);
  });

  if ("_embed" in args) {
    params._embed = "true";
  }

  Object.entries(overrides).forEach(([key, value]) => {
    if (value) {
      params[key] = value;
    }
  });

  return params;
};

const isMediaRoute = (routePath: string) => routePath.endsWith("/media");

interface ExplorerAppProps {
  initialPathname?: string;
}

export default function ExplorerApp({ initialPathname = "/" }: ExplorerAppProps) {
  const [pathname, setPathname] = useState(initialPathname);

  const [connection, setConnection] = useState<SiteConnection | null>(null);
  const [routes, setRoutes] = useState<WpRouteInfo[]>([]);
  const [collections, setCollections] = useState<ContentCollection[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<WpRouteInfo | null>(null);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [showDevConsole, setShowDevConsole] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [perPagePreference, setPerPagePreference] = useState(DEFAULT_PER_PAGE);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [queryParams, setQueryParams] = useState<Record<string, string>>({
    page: "1",
    per_page: DEFAULT_PER_PAGE,
    _embed: "true",
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [responseData, setResponseData] = useState<unknown>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{
    status: number | null;
    statusText: string;
    timeMs: number | null;
    totalRecords: number | null;
    totalPages: number | null;
  } | null>(null);

  const hydratedBookmarkPathRef = useRef<string | null>(null);
  const internalNavigationPathRef = useRef<string | null>(null);

  const bookmark = useMemo(() => parseExplorerPath(pathname), [pathname]);

  const constructedUrl = useMemo(() => {
    if (!connection || !selectedRoute) {
      return "";
    }

    const path = selectedRoute.path === "/" ? "" : selectedRoute.path;
    const baseUrl = connection.apiRoot.replace(/\/+$/, "") + path;
    const url = new URL(baseUrl);

    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  }, [connection, queryParams, selectedRoute]);

  const selectedCollection = useMemo(() => {
    if (!selectedRoute) {
      return null;
    }

    return findCollectionByRoutePath(collections, selectedRoute.path);
  }, [collections, selectedRoute]);

  const coreCollections = useMemo(
    () => collections.filter((collection) => collection.isCore),
    [collections]
  );
  const customCollections = useMemo(
    () => collections.filter((collection) => !collection.isCore),
    [collections]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePopState = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as "light" | "dark" | "system" | null;
    const savedPerPage = getStoredPerPage();
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
      setPerPagePreference(savedPerPage);
      setQueryParams((current) => ({
        ...current,
        per_page: current.per_page || savedPerPage,
      }));
      setPreferencesReady(true);
      applyTheme(initialTheme);
    }, 0);

    mediaQuery.addEventListener("change", handleThemePreferenceChange);
    return () => {
      window.clearTimeout(timeoutId);
      mediaQuery.removeEventListener("change", handleThemePreferenceChange);
    };
  }, []);

  const handleThemeChange = useCallback((nextTheme: "light" | "dark" | "system") => {
    setTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }, []);

  const fetchJson = useCallback(async (conn: SiteConnection, targetUrl: string) => {
    const headers = new Headers();
    if (conn.auth) {
      const basicHash = btoa(`${conn.auth.username}:${conn.auth.appPassword}`);
      headers.set("Authorization", `Basic ${basicHash}`);
    }

    const fetchUrl = conn.useProxy ? `/api/proxy?url=${encodeURIComponent(targetUrl)}` : targetUrl;
    return fetch(fetchUrl, {
      method: "GET",
      headers,
    });
  }, []);

  const executeApiRequest = useCallback(
    async (conn: SiteConnection, route: WpRouteInfo, params: Record<string, string>) => {
      setIsLoading(true);
      setRequestError(null);
      setMetrics(null);

      const startTime = performance.now();
      const path = route.path === "/" ? "" : route.path;
      const baseUrl = conn.apiRoot.replace(/\/+$/, "") + path;
      const url = new URL(baseUrl);

      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, value);
        }
      });

      try {
        const response = await fetchJson(conn, url.toString());
        const durationMs = Math.round(performance.now() - startTime);
        const wpTotal = response.headers.get("x-wp-total");
        const wpTotalPages = response.headers.get("x-wp-totalpages");

        setMetrics({
          status: response.status,
          statusText: response.statusText,
          timeMs: durationMs,
          totalRecords: wpTotal ? Number.parseInt(wpTotal, 10) : null,
          totalPages: wpTotalPages ? Number.parseInt(wpTotalPages, 10) : null,
        });

        const text = await response.text();
        let json: unknown = null;

        try {
          json = JSON.parse(text);
        } catch {
          setRequestError(`Invalid JSON response: ${text.substring(0, 120)}...`);
          setResponseData(null);
          return;
        }

        if (!response.ok) {
          const errorMessage =
            json && typeof json === "object" && "message" in json && typeof json.message === "string"
              ? json.message
              : json && typeof json === "object" && "error" in json && typeof json.error === "string"
              ? json.error
              : `HTTP request failed with status ${response.status}: ${response.statusText}`;

          setRequestError(errorMessage);
          setResponseData(null);
          return;
        }

        setResponseData(json);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setRequestError(errorMessage || "An error occurred during the fetch request.");
        setResponseData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchJson]
  );

  const fetchTypeCollections = useCallback(
    async (conn: SiteConnection, parsedRoutes: WpRouteInfo[]) => {
      try {
        const response = await fetchJson(conn, `${conn.apiRoot.replace(/\/+$/, "")}/wp/v2/types`);
        if (!response.ok) {
          return getCoreCollections(parsedRoutes);
        }

        const json = (await response.json()) as Record<string, WpTypeDefinition>;
        return [...getCoreCollections(parsedRoutes), ...getCustomCollections(parsedRoutes, json)];
      } catch {
        return getCoreCollections(parsedRoutes);
      }
    },
    [fetchJson]
  );

  const syncBookmarkUrl = useCallback(
    (collection: ContentCollection | null, siteUrl: string, page: string, mode: "push" | "replace") => {
      if (!collection) {
        return;
      }

      const nextPath = buildExplorerPath({
        siteUrl,
        contentType: collection.slug,
        page,
      });

      if (nextPath === pathname) {
        return;
      }

      internalNavigationPathRef.current = nextPath;

      if (typeof window !== "undefined") {
        if (mode === "replace") {
          window.history.replaceState({}, "", nextPath);
        } else {
          window.history.pushState({}, "", nextPath);
        }
        setPathname(nextPath);
      }
    },
    [pathname]
  );

  const connectToSite = useCallback(
    async ({
      siteUrl,
      useProxy,
      auth,
      desiredContentType,
      desiredPage,
      desiredRoutePath,
      navigationMode,
    }: {
      siteUrl: string;
      useProxy: boolean;
      auth: { username: string; appPassword: string } | null;
      desiredContentType?: string;
      desiredPage?: string;
      desiredRoutePath?: string;
      navigationMode: "push" | "replace";
    }) => {
      setIsConnecting(true);
      setConnectionError(null);

      try {
        const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
        const { apiRoot, schema } = await discoverWpApiRoot(normalizedSiteUrl, useProxy);
        const parsedRoutes = parseWpSchema(schema);
        const nextConnection: SiteConnection = {
          siteUrl: normalizedSiteUrl,
          apiRoot,
          schema,
          useProxy,
          auth,
        };

        const nextCollections = await fetchTypeCollections(nextConnection, parsedRoutes);
        const defaultRoute =
          (desiredRoutePath && parsedRoutes.find((route) => route.path === desiredRoutePath)) ||
          (desiredContentType &&
            findCollectionBySlug(nextCollections, desiredContentType) &&
            parsedRoutes.find(
              (route) =>
                route.path === findCollectionBySlug(nextCollections, desiredContentType)?.routePath
            )) ||
          parsedRoutes.find((route) => route.path === "/wp/v2/posts") ||
          parsedRoutes[0] ||
          null;

        const nextParams = defaultRoute
          ? buildBaseQueryParams(defaultRoute, perPagePreference, {
              page: desiredPage || "1",
              per_page: perPagePreference,
            })
          : {
              page: desiredPage || "1",
              per_page: perPagePreference,
            };

        setConnection(nextConnection);
        setRoutes(parsedRoutes);
        setCollections(nextCollections);
        setSelectedRoute(defaultRoute);
        setQueryParams(nextParams);
        setResponseData(null);
        setMetrics(null);
        setRequestError(null);

        persistConnection({
          siteUrl: normalizedSiteUrl,
          useProxy,
          auth,
        });

        if (defaultRoute) {
          const collection = findCollectionByRoutePath(nextCollections, defaultRoute.path);
          syncBookmarkUrl(
            collection,
            normalizedSiteUrl,
            nextParams.page || "1",
            navigationMode
          );
          await executeApiRequest(nextConnection, defaultRoute, nextParams);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setConnectionError(
          errorMessage ||
            "Failed to connect to the WordPress REST API. Check the site URL and proxy mode."
        );
      } finally {
        setIsConnecting(false);
      }
    },
    [executeApiRequest, fetchTypeCollections, perPagePreference, syncBookmarkUrl]
  );

  useEffect(() => {
    if (!preferencesReady) {
      return;
    }

    if (!bookmark) {
      return;
    }

    if (internalNavigationPathRef.current === pathname) {
      internalNavigationPathRef.current = null;
      hydratedBookmarkPathRef.current = pathname;
      return;
    }

    if (hydratedBookmarkPathRef.current === pathname) {
      return;
    }

    const normalizedBookmarkSite = normalizeSiteUrl(bookmark.siteUrl);
    const siteMatches = connection
      ? normalizeSiteUrl(connection.siteUrl) === normalizedBookmarkSite
      : false;

    if (siteMatches && connection) {
      const targetCollection = findCollectionBySlug(collections, bookmark.contentType);
      const targetRoute = targetCollection
        ? routes.find((route) => route.path === targetCollection.routePath) || null
        : null;

      if (!targetCollection || !targetRoute) {
        hydratedBookmarkPathRef.current = pathname;
        return;
      }

      const routeMatches = selectedRoute?.path === targetRoute.path;
      const pageMatches = (queryParams.page || "1") === bookmark.page;

      if (routeMatches && pageMatches) {
        hydratedBookmarkPathRef.current = pathname;
        return;
      }

      hydratedBookmarkPathRef.current = pathname;
      const timeoutId = window.setTimeout(() => {
        const nextParams = routeMatches
          ? { ...queryParams, page: bookmark.page }
          : buildBaseQueryParams(targetRoute, perPagePreference, {
              page: bookmark.page,
              per_page: queryParams.per_page || perPagePreference,
            });

        setSelectedRoute(targetRoute);
        setQueryParams(nextParams);
        setResponseData(null);
        setMetrics(null);
        setRequestError(null);
        void executeApiRequest(connection, targetRoute, nextParams);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const storedConnection = getStoredConnection();
    const matchesStoredSite =
      storedConnection &&
      normalizeSiteUrl(storedConnection.siteUrl) === normalizedBookmarkSite;

    hydratedBookmarkPathRef.current = pathname;
    const timeoutId = window.setTimeout(() => {
      void connectToSite({
        siteUrl: bookmark.siteUrl,
        useProxy: matchesStoredSite ? storedConnection.useProxy : false,
        auth: matchesStoredSite ? storedConnection.auth : null,
        desiredContentType: bookmark.contentType,
        desiredPage: bookmark.page,
        navigationMode: "replace",
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    bookmark,
    collections,
    connectToSite,
    connection,
    executeApiRequest,
    pathname,
    perPagePreference,
    preferencesReady,
    queryParams,
    routes,
    selectedRoute,
  ]);

  const navigateSimpleCollection = useCallback(
    async (collection: ContentCollection, page = "1") => {
      if (!connection) {
        return;
      }

      const route = routes.find((candidate) => candidate.path === collection.routePath);
      if (!route) {
        return;
      }

      const nextParams = buildBaseQueryParams(route, perPagePreference, {
        page,
        per_page: perPagePreference,
      });

      setSelectedRoute(route);
      setQueryParams(nextParams);
      setResponseData(null);
      setMetrics(null);
      setRequestError(null);
      syncBookmarkUrl(collection, connection.siteUrl, page, "push");
      await executeApiRequest(connection, route, nextParams);
    },
    [connection, executeApiRequest, perPagePreference, routes, syncBookmarkUrl]
  );

  const handleAdvancedRouteSelect = useCallback(
    (route: WpRouteInfo) => {
      setSelectedRoute(route);
      setResponseData(null);
      setMetrics(null);
      setRequestError(null);
      setQueryParams(buildBaseQueryParams(route, perPagePreference));
    },
    [perPagePreference]
  );

  const handleSendRequest = useCallback(() => {
    if (connection && selectedRoute) {
      executeApiRequest(connection, selectedRoute, queryParams);
    }
  }, [connection, executeApiRequest, queryParams, selectedRoute]);

  const handleDisconnect = useCallback(() => {
    setConnection(null);
    setRoutes([]);
    setCollections([]);
    setSelectedRoute(null);
    setResponseData(null);
    setMetrics(null);
    setRequestError(null);
    setConnectionError(null);
    persistConnection(null);
    hydratedBookmarkPathRef.current = null;
    internalNavigationPathRef.current = null;

    if (pathname !== "/" && typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
      setPathname("/");
    }
  }, [pathname]);

  const handlePerPageChange = useCallback(
    async (value: string | null) => {
      if (!selectedRoute || !connection) {
        return;
      }

      if (!value) {
        return;
      }

      localStorage.setItem(PER_PAGE_STORAGE_KEY, value);
      setPerPagePreference(value);

      const nextParams = {
        ...queryParams,
        per_page: value,
        page: "1",
      };

      setQueryParams(nextParams);

      if (selectedCollection) {
        syncBookmarkUrl(selectedCollection, connection.siteUrl, "1", "push");
      }

      await executeApiRequest(connection, selectedRoute, nextParams);
    },
    [connection, executeApiRequest, queryParams, selectedCollection, selectedRoute, syncBookmarkUrl]
  );

  const getRouteLabel = useCallback(
    (route: WpRouteInfo) => {
      const collection = findCollectionByRoutePath(collections, route.path);
      if (collection) {
        return collection.label;
      }

      const segments = route.path.split("/");
      return humanizeSegment(segments[segments.length - 1] || route.path);
    },
    [collections]
  );

  const isSelectedMediaRoute = selectedRoute ? isMediaRoute(selectedRoute.path) : false;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15">
                <Moon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-foreground">
                    WordPress API Explorer
                  </h1>
                  <Badge variant="outline" className="border-primary/20 text-xs font-semibold text-primary">
                    v1.3
                  </Badge>
                </div>
                {connection ? (
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-primary" />
                      {connection.schema.name || "WordPress Site"}
                    </span>
                    <span className="font-mono text-xs">{connection.apiRoot}</span>
                    <a
                      href={connection.schema.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary/80"
                    >
                      Open site
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : null}
              </div>
            </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleThemeChange("light")}
                  className={`h-8 w-8 ${theme === "light" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
                  title="Light mode"
                >
                  <Sun className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleThemeChange("system")}
                  className={`h-8 w-8 ${theme === "system" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
                  title="System theme"
                >
                  <Laptop className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleThemeChange("dark")}
                  className={`h-8 w-8 ${theme === "dark" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
                  title="Dark mode"
                >
                  <Moon className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">Advanced mode</div>
                </div>
                <Switch
                  checked={isAdvancedMode}
                  onCheckedChange={(checked) => {
                    setIsAdvancedMode(checked);
                    if (selectedRoute) {
                      setQueryParams(buildBaseQueryParams(selectedRoute, perPagePreference));
                      setResponseData(null);
                      setMetrics(null);
                      setRequestError(null);
                    }
                  }}
                />
              </div>

              {connection ? (
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  className="h-10 gap-1.5 text-sm text-muted-foreground hover:border-destructive/30 hover:text-destructive"
                >
                  <Unlink className="h-4 w-4" />
                  Disconnect
                </Button>
              ) : null}
            </div>
          </div>

          <SiteSelector
            key={connection?.siteUrl || bookmark?.siteUrl || "disconnected"}
            connectionError={connectionError}
            currentSiteUrl={connection?.siteUrl || bookmark?.siteUrl || null}
            hideExamples={Boolean(connection) || isAdvancedMode}
            isLoading={isConnecting}
            onConnect={({ siteUrl, useProxy, auth }) => {
              void connectToSite({
                siteUrl,
                useProxy,
                auth,
                desiredContentType: selectedCollection?.slug || bookmark?.contentType,
                desiredPage: "1",
                desiredRoutePath: isAdvancedMode ? selectedRoute?.path : undefined,
                navigationMode: "replace",
              });
            }}
          />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 min-h-0">
        {connection ? (
          <aside className="hidden w-[280px] shrink-0 border-r border-border/40 bg-card/10 p-4 lg:block">
            {isAdvancedMode ? (
              <RouteNavigator
                routes={routes}
                selectedRoute={selectedRoute?.path || ""}
                onSelectRoute={handleAdvancedRouteSelect}
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
                          onClick={() => navigateSimpleCollection(collection)}
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
                                onClick={() => navigateSimpleCollection(collection)}
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

        <main className="flex-1 min-w-0 overflow-y-auto bg-background/25 px-4 py-5 md:px-6">
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
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {selectedRoute ? (
                isAdvancedMode ? (
                  <>
                    <RequestConsole
                      method="GET"
                      targetUrl={constructedUrl}
                      useProxy={connection.useProxy}
                      auth={connection.auth}
                      isLoading={isLoading}
                      onTriggerRequest={handleSendRequest}
                      metrics={metrics}
                    />

                    <QueryBuilder
                      route={selectedRoute}
                      queryParams={queryParams}
                      onParamsChange={(params) => {
                        setQueryParams(params);
                        if (params.per_page) {
                          localStorage.setItem(PER_PAGE_STORAGE_KEY, params.per_page);
                          setPerPagePreference(params.per_page);
                        }
                      }}
                    />
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
                            <Select value={queryParams.per_page || perPagePreference} onValueChange={handlePerPageChange}>
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
                              onClick={async () => {
                                if (!selectedCollection || !selectedRoute) {
                                  return;
                                }

                                const previousPage = Math.max(1, Number.parseInt(queryParams.page || "1", 10) - 1);
                                const nextParams = { ...queryParams, page: String(previousPage) };
                                setQueryParams(nextParams);
                                syncBookmarkUrl(selectedCollection, connection.siteUrl, String(previousPage), "push");
                                await executeApiRequest(connection, selectedRoute, nextParams);
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
                              onClick={async () => {
                                if (!selectedCollection || !selectedRoute) {
                                  return;
                                }

                                const nextPage = Number.parseInt(queryParams.page || "1", 10) + 1;
                                const nextParams = { ...queryParams, page: String(nextPage) };
                                setQueryParams(nextParams);
                                syncBookmarkUrl(selectedCollection, connection.siteUrl, String(nextPage), "push");
                                await executeApiRequest(connection, selectedRoute, nextParams);
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
                                if (event.key === "Enter" && connection) {
                                  executeApiRequest(connection, selectedRoute, queryParams);
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
                            onClick={async () => {
                              if (!selectedRoute) {
                                return;
                              }

                              if (selectedCollection) {
                                syncBookmarkUrl(selectedCollection, connection.siteUrl, queryParams.page || "1", "push");
                              }

                              await executeApiRequest(connection, selectedRoute, queryParams);
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
                          <RequestConsole
                            method="GET"
                            targetUrl={constructedUrl}
                            useProxy={connection.useProxy}
                            auth={connection.auth}
                            isLoading={isLoading}
                            onTriggerRequest={handleSendRequest}
                            metrics={metrics}
                          />
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
    </div>
  );
}
