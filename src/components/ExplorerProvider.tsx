"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ExplorerContext, ExplorerContextValue } from "@/contexts/ExplorerContext";
import { RequestContext, RequestContextValue } from "@/contexts/RequestContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import {
  buildExplorerPath,
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
  WpTypeDefinition,
} from "@/lib/explorer";
import {
  buildBaseQueryParams,
  ConnectToSiteOptions,
  getStoredConnection,
  getStoredPerPage,
  persistConnection,
  ResponseMetrics,
  SiteConnection,
} from "@/lib/explorer-client";
import { WpRouteInfo, discoverWpApiRoot, parseWpSchema } from "@/lib/wp-schema";

interface ExplorerProviderProps {
  children: React.ReactNode;
  initialPathname?: string;
}

export default function ExplorerProvider({
  children,
  initialPathname = "/",
}: ExplorerProviderProps) {
  const [pathname, setPathname] = useState(initialPathname);

  const [connection, setConnection] = useState<SiteConnection | null>(null);
  const [routes, setRoutes] = useState<WpRouteInfo[]>([]);
  const [collections, setCollections] = useState<ContentCollection[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<WpRouteInfo | null>(null);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [perPagePreference, setPerPagePreference] = useState(DEFAULT_PER_PAGE);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [queryParams, setQueryParamsState] = useState<Record<string, string>>({
    page: "1",
    per_page: DEFAULT_PER_PAGE,
    _embed: "true",
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [responseData, setResponseData] = useState<unknown>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ResponseMetrics | null>(null);

  const [hydratedBookmarkPath, setHydratedBookmarkPath] = useState<string | null>(null);
  const [internalNavigationPath, setInternalNavigationPath] = useState<string | null>(null);

  const bookmark = useMemo(() => parseExplorerPath(pathname), [pathname]);

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
    if (typeof window === "undefined") {
      return;
    }

    const savedPerPage = getStoredPerPage();
    const timeoutId = window.setTimeout(() => {
      setPerPagePreference(savedPerPage);
      setQueryParamsState((current) => ({
        ...current,
        per_page: current.per_page || savedPerPage,
      }));
      setPreferencesReady(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const clearRequestState = useCallback(() => {
    setResponseData(null);
    setMetrics(null);
    setRequestError(null);
  }, []);

  const persistPerPagePreference = useCallback((value: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(PER_PAGE_STORAGE_KEY, value);
    }

    setPerPagePreference(value);
  }, []);

  const setQueryParams = useCallback<React.Dispatch<React.SetStateAction<Record<string, string>>>>(
    (updater) => {
      setQueryParamsState((current) => {
        const nextParams = typeof updater === "function" ? updater(current) : updater;
        if (nextParams.per_page && nextParams.per_page !== current.per_page) {
          persistPerPagePreference(nextParams.per_page);
        }

        return nextParams;
      });
    },
    [persistPerPagePreference]
  );

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

      setInternalNavigationPath(nextPath);

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

  const resetForRoute = useCallback(
    (route: WpRouteInfo, overrides: Record<string, string> = {}) => {
      const nextParams = buildBaseQueryParams(route, perPagePreference, overrides);
      setQueryParamsState(nextParams);
      clearRequestState();
      return nextParams;
    },
    [clearRequestState, perPagePreference]
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
    }: ConnectToSiteOptions) => {
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
        const targetCollection = desiredContentType
          ? findCollectionBySlug(nextCollections, desiredContentType)
          : null;
        const defaultRoute =
          (desiredRoutePath && parsedRoutes.find((route) => route.path === desiredRoutePath)) ||
          (targetCollection &&
            parsedRoutes.find((route) => route.path === targetCollection.routePath)) ||
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
        setQueryParamsState(nextParams);
        clearRequestState();

        persistConnection({
          siteUrl: normalizedSiteUrl,
          useProxy,
          auth,
        });

        if (defaultRoute) {
          const collection = findCollectionByRoutePath(nextCollections, defaultRoute.path);
          syncBookmarkUrl(collection, normalizedSiteUrl, nextParams.page || "1", navigationMode);
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
    [clearRequestState, executeApiRequest, fetchTypeCollections, perPagePreference, syncBookmarkUrl]
  );

  useEffect(() => {
    if (!preferencesReady || !bookmark) {
      return;
    }

    if (internalNavigationPath === pathname) {
      const timeoutId = window.setTimeout(() => {
        setInternalNavigationPath(null);
        setHydratedBookmarkPath(pathname);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    if (hydratedBookmarkPath === pathname) {
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
        const timeoutId = window.setTimeout(() => {
          setHydratedBookmarkPath(pathname);
        }, 0);

        return () => window.clearTimeout(timeoutId);
      }

      const routeMatches = selectedRoute?.path === targetRoute.path;
      const pageMatches = (queryParams.page || "1") === bookmark.page;

      if (routeMatches && pageMatches) {
        const timeoutId = window.setTimeout(() => {
          setHydratedBookmarkPath(pathname);
        }, 0);

        return () => window.clearTimeout(timeoutId);
      }

      const timeoutId = window.setTimeout(() => {
        setHydratedBookmarkPath(pathname);
        const nextParams = routeMatches
          ? { ...queryParams, page: bookmark.page }
          : buildBaseQueryParams(targetRoute, perPagePreference, {
              page: bookmark.page,
              per_page: queryParams.per_page || perPagePreference,
            });

        setSelectedRoute(targetRoute);
        setQueryParamsState(nextParams);
        clearRequestState();
        void executeApiRequest(connection, targetRoute, nextParams);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const storedConnection = getStoredConnection();
    const matchesStoredSite =
      storedConnection &&
      normalizeSiteUrl(storedConnection.siteUrl) === normalizedBookmarkSite;

    const timeoutId = window.setTimeout(() => {
      setHydratedBookmarkPath(pathname);
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
    clearRequestState,
    collections,
    connectToSite,
    connection,
    executeApiRequest,
    hydratedBookmarkPath,
    internalNavigationPath,
    pathname,
    perPagePreference,
    preferencesReady,
    queryParams,
    routes,
    selectedRoute,
  ]);

  const syncCurrentBookmark = useCallback(
    (page: string, mode: "push" | "replace") => {
      if (!connection || !selectedCollection) {
        return;
      }

      syncBookmarkUrl(selectedCollection, connection.siteUrl, page, mode);
    },
    [connection, selectedCollection, syncBookmarkUrl]
  );

  const navigateCollection = useCallback(
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
      setQueryParamsState(nextParams);
      clearRequestState();
      syncBookmarkUrl(collection, connection.siteUrl, page, "push");
      await executeApiRequest(connection, route, nextParams);
    },
    [clearRequestState, connection, executeApiRequest, perPagePreference, routes, syncBookmarkUrl]
  );

  const selectRoute = useCallback(
    (route: WpRouteInfo) => {
      setSelectedRoute(route);
      resetForRoute(route);
    },
    [resetForRoute]
  );

  const setAdvancedMode = useCallback(
    (enabled: boolean) => {
      setIsAdvancedMode(enabled);
      if (selectedRoute) {
        resetForRoute(selectedRoute);
      }
    },
    [resetForRoute, selectedRoute]
  );

  const executeCurrentRequest = useCallback(
    async (paramsOverride?: Record<string, string>) => {
      if (!connection || !selectedRoute) {
        return;
      }

      await executeApiRequest(connection, selectedRoute, paramsOverride || queryParams);
    },
    [connection, executeApiRequest, queryParams, selectedRoute]
  );

  const changePerPage = useCallback(
    async (value: string | null) => {
      if (!selectedRoute || !connection || !value) {
        return;
      }

      persistPerPagePreference(value);

      const nextParams = {
        ...queryParams,
        per_page: value,
        page: "1",
      };

      setQueryParamsState(nextParams);
      syncCurrentBookmark("1", "push");
      await executeApiRequest(connection, selectedRoute, nextParams);
    },
    [
      connection,
      executeApiRequest,
      persistPerPagePreference,
      queryParams,
      selectedRoute,
      syncCurrentBookmark,
    ]
  );

  const disconnect = useCallback(() => {
    setConnection(null);
    setRoutes([]);
    setCollections([]);
    setSelectedRoute(null);
    clearRequestState();
    setIsLoading(false);
    setConnectionError(null);
    persistConnection(null);
    setHydratedBookmarkPath(null);
    setInternalNavigationPath(null);

    if (pathname !== "/" && typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
      setPathname("/");
    }
  }, [clearRequestState, pathname]);

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

  const explorerContextValue = useMemo<ExplorerContextValue>(
    () => ({
      state: {
        connection,
        routes,
        collections,
        selectedRoute,
        isAdvancedMode,
        isConnecting,
        connectionError,
      },
      actions: {
        connectToSite,
        disconnect,
        selectRoute,
        navigateCollection,
        setAdvancedMode,
        syncCurrentBookmark,
      },
      meta: {
        selectedCollection,
        coreCollections,
        customCollections,
        getRouteLabel,
        suggestedSiteUrl: connection?.siteUrl || bookmark?.siteUrl || "",
        bookmarkContentType: bookmark?.contentType || null,
      },
    }),
    [
      bookmark?.contentType,
      bookmark?.siteUrl,
      connectToSite,
      connection,
      connectionError,
      coreCollections,
      customCollections,
      disconnect,
      getRouteLabel,
      isAdvancedMode,
      isConnecting,
      navigateCollection,
      routes,
      selectRoute,
      selectedCollection,
      selectedRoute,
      setAdvancedMode,
      syncCurrentBookmark,
      collections,
    ]
  );

  const requestContextValue = useMemo<RequestContextValue>(
    () => ({
      state: {
        queryParams,
        isLoading,
        responseData,
        requestError,
        metrics,
      },
      actions: {
        setQueryParams,
        executeCurrentRequest,
        resetForRoute,
        changePerPage,
      },
      meta: {
        constructedUrl,
      },
    }),
    [
      changePerPage,
      constructedUrl,
      executeCurrentRequest,
      isLoading,
      metrics,
      queryParams,
      requestError,
      resetForRoute,
      responseData,
      setQueryParams,
    ]
  );

  return (
    <ThemeProvider>
      <ExplorerContext.Provider value={explorerContextValue}>
        <RequestContext.Provider value={requestContextValue}>{children}</RequestContext.Provider>
      </ExplorerContext.Provider>
    </ThemeProvider>
  );
}
