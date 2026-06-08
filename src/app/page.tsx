"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import SiteSelector from "@/components/SiteSelector";
import RouteNavigator from "@/components/RouteNavigator";
import QueryBuilder from "@/components/QueryBuilder";
import RequestConsole from "@/components/RequestConsole";
import VisualReader from "@/components/VisualReader";
import DataTable from "@/components/DataTable";
import JsonViewer from "@/components/JsonViewer";
import { WpRouteInfo, WpSchema, parseWpSchema } from "@/lib/wp-schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Terminal, 
  Globe, 
  ExternalLink, 
  Unlink, 
  Database,
  Eye, 
  Table as TableIcon, 
  Code as CodeIcon,
  Loader2,
  ShieldAlert,
  Moon,
  Sparkles,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Layers,
  Image as ImageIcon,
  MessageSquare,
  User,
  Sun,
  Laptop
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface SiteConnection {
  siteUrl: string;
  apiRoot: string;
  schema: WpSchema;
  useProxy: boolean;
  auth: { username: string; appPassword: string } | null;
}

export default function Home() {
  const [connection, setConnection] = useState<SiteConnection | null>(null);
  const [routes, setRoutes] = useState<WpRouteInfo[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<WpRouteInfo | null>(null);
  
  // Navigation mode: Simple vs Advanced (Schema Explorer)
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [showDevConsole, setShowDevConsole] = useState(false);

  // Theme state: light | dark | system
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  // Query parameters state
  const [queryParams, setQueryParams] = useState<Record<string, string>>({
    page: "1",
    per_page: "10",
    _embed: "true",
  });

  // Connecting site loading
  const [isConnecting, setIsConnecting] = useState(false);

  // Request firing states
  const [isLoading, setIsLoading] = useState(false);
  const [responseData, setResponseData] = useState<unknown>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  
  const [metrics, setMetrics] = useState<{
    status: number | null;
    statusText: string;
    timeMs: number | null;
    totalRecords: number | null;
    totalPages: number | null;
  } | null>(null);

  // Derived state: constructed URL
  const constructedUrl = useMemo(() => {
    if (!connection || !selectedRoute) {
      return "";
    }

    const path = selectedRoute.path === "/" ? "" : selectedRoute.path;
    const baseUrl = connection.apiRoot.replace(/\/+$/, "") + path;

    const urlObj = new URL(baseUrl);
    Object.entries(queryParams).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        urlObj.searchParams.set(key, val);
      }
    });

    return urlObj.toString();
  }, [connection, selectedRoute, queryParams]);

  // Setup theme on mount and watch system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    const initialTheme = savedTheme || "system";
    
    // Set the initial theme state asynchronously to prevent React 19's sync setState in effect warning
    if (initialTheme !== "system") {
      setTimeout(() => setTheme(initialTheme), 0);
    }
    
    applyTheme(initialTheme);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const currentTheme = localStorage.getItem("theme") || "system";
      if (currentTheme === "system") {
        applyTheme("system");
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const handleThemeChange = useCallback((newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  }, []);

  // Categorize routes for Simple Mode
  const { coreContentTypes, customContentTypes } = useMemo(() => {
    const corePaths = [
      "/wp/v2/posts",
      "/wp/v2/pages",
      "/wp/v2/media",
      "/wp/v2/comments",
      "/wp/v2/users"
    ];
    
    const core = routes.filter(r => corePaths.includes(r.path));
    const custom = routes.filter(
      r => !corePaths.includes(r.path) && r.path !== "/" && r.namespace !== "index"
    );
    
    return { coreContentTypes: core, customContentTypes: custom };
  }, [routes]);

  // Execute the API Request
  const executeApiRequest = useCallback(async (
    conn: SiteConnection,
    route: WpRouteInfo,
    params: Record<string, string>
  ) => {
    setIsLoading(true);
    setRequestError(null);
    setMetrics(null);
    
    const startTime = performance.now();
    
    // Construct request URL
    const path = route.path === "/" ? "" : route.path;
    const baseUrl = conn.apiRoot.replace(/\/+$/, "") + path;
    const urlObj = new URL(baseUrl);
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        urlObj.searchParams.set(key, val);
      }
    });
    
    const targetUrl = urlObj.toString();

    try {
      const headers = new Headers();
      if (conn.auth) {
        const basicHash = btoa(`${conn.auth.username}:${conn.auth.appPassword}`);
        headers.set("Authorization", `Basic ${basicHash}`);
      }

      const fetchUrl = conn.useProxy
        ? `/api/proxy?url=${encodeURIComponent(targetUrl)}`
        : targetUrl;

      const response = await fetch(fetchUrl, {
        method: "GET",
        headers,
      });

      const endTime = performance.now();
      const durationMs = Math.round(endTime - startTime);

      const wpTotal = response.headers.get("x-wp-total");
      const wpTotalPages = response.headers.get("x-wp-totalpages");

      const status = response.status;
      const statusText = response.statusText;

      setMetrics({
        status,
        statusText,
        timeMs: durationMs,
        totalRecords: wpTotal ? parseInt(wpTotal, 10) : null,
        totalPages: wpTotalPages ? parseInt(wpTotalPages, 10) : null,
      });

      const text = await response.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        setRequestError(`Invalid JSON response: ${text.substring(0, 100)}...`);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errorMsg =
          json && typeof json === "object" && "message" in json && typeof (json as { message: unknown }).message === "string"
            ? (json as { message: string }).message
            : json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : `HTTP request failed with status ${status}: ${statusText}`;
        setRequestError(errorMsg);
        setIsLoading(false);
        return;
      }

      setResponseData(json);
    } catch (err: unknown) {
      console.error("API call failed:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setRequestError(errorMessage || "An error occurred during the fetch request.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSendRequest = () => {
    if (connection && selectedRoute) {
      executeApiRequest(connection, selectedRoute, queryParams);
    }
  };

  // Trigger site connection
  const handleSiteConnect = async (data: SiteConnection) => {
    setIsConnecting(true);
    try {
      setConnection(data);
      const parsedRoutes = parseWpSchema(data.schema);
      setRoutes(parsedRoutes);
      
      // Select core posts route as default if it exists, otherwise the first route
      const defaultRoute = parsedRoutes.find(r => r.path === "/wp/v2/posts") || parsedRoutes[0] || null;
      setSelectedRoute(defaultRoute);
      
      const initialParams = {
        page: "1",
        per_page: "10",
        _embed: "true",
      };
      setQueryParams(initialParams);
      setResponseData(null);
      setMetrics(null);
      setRequestError(null);

      // Auto-fetch data on connect
      if (defaultRoute) {
        executeApiRequest(data, defaultRoute, initialParams);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Select route under Simple Mode
  const handleSimpleRouteSelect = (route: WpRouteInfo) => {
    setSelectedRoute(route);
    
    const newParams: Record<string, string> = {
      page: "1",
      per_page: queryParams.per_page || "10",
    };

    const args = route.endpoints?.[0]?.args || {};
    if ("_embed" in args) {
      newParams["_embed"] = "true";
    }

    setQueryParams(newParams);
    setResponseData(null);
    setMetrics(null);
    setRequestError(null);

    // Auto-fetch data
    if (connection) {
      executeApiRequest(connection, route, newParams);
    }
  };

  // Select route under Advanced Mode
  const handleAdvancedRouteSelect = (route: WpRouteInfo) => {
    setSelectedRoute(route);
    
    // Set parameter defaults defined in schema if present
    const defaultParams: Record<string, string> = {
      page: "1",
      per_page: "10",
    };

    const args = route.endpoints?.[0]?.args || {};
    Object.entries(args).forEach(([key, schemaArg]) => {
      if (schemaArg.default !== undefined) {
        defaultParams[key] = String(schemaArg.default);
      }
    });

    if ("_embed" in args) {
      defaultParams["_embed"] = "true";
    }

    setQueryParams(defaultParams);
    setResponseData(null);
    setMetrics(null);
    setRequestError(null);
  };

  // Re-build target URL is now handled reactively via useMemo: constructedUrl

  const handleDisconnect = () => {
    setConnection(null);
    setRoutes([]);
    setSelectedRoute(null);
    setResponseData(null);
    setMetrics(null);
    setRequestError(null);
  };

  const getRouteLabel = (route: WpRouteInfo) => {
    const segments = route.path.split("/");
    const last = segments[segments.length - 1] || route.path;
    return last.replace(/_/g, " ").toUpperCase();
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-background">
      {/* Sidebar Panel */}
      <aside className="w-full md:w-[350px] border-b md:border-b-0 md:border-r border-border/40 p-4 flex flex-col gap-4 bg-card/10 shrink-0">
        <div className="flex items-center gap-2 border-b border-border/25 pb-3">
          <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
            <Moon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
              WordPress API Explorer
              <Badge variant="outline" className="text-xs px-1.5 py-0 border-primary/20 text-primary font-bold">
                v1.2
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">Dynamic Content Inspector</p>
          </div>
        </div>

        <SiteSelector onConnect={handleSiteConnect} isLoading={isConnecting} />

        {connection && (
          <div className="flex-1 flex flex-col justify-between min-h-[300px]">
            {isAdvancedMode ? (
              /* Advanced Schema Navigator */
              <RouteNavigator
                routes={routes}
                selectedRoute={selectedRoute?.path || ""}
                onSelectRoute={handleAdvancedRouteSelect}
              />
            ) : (
              /* Simple Content Types Menu */
              <div className="flex-1 flex flex-col space-y-4 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2 px-2">
                    Content Types
                  </span>
                  <div className="space-y-0.5">
                    {coreContentTypes.map((route) => {
                      const isActive = selectedRoute?.path === route.path;
                      let icon = <FileText className="h-4.5 w-4.5 shrink-0" />;
                      let label = "Posts";
                      
                      if (route.path.endsWith("/posts")) {
                        label = "Posts";
                        icon = <FileText className="h-4.5 w-4.5 shrink-0" />;
                      } else if (route.path.endsWith("/pages")) {
                        label = "Pages";
                        icon = <Layers className="h-4.5 w-4.5 shrink-0" />;
                      } else if (route.path.endsWith("/media")) {
                        label = "Media";
                        icon = <ImageIcon className="h-4.5 w-4.5 shrink-0" />;
                      } else if (route.path.endsWith("/comments")) {
                        label = "Comments";
                        icon = <MessageSquare className="h-4.5 w-4.5 shrink-0" />;
                      } else if (route.path.endsWith("/users")) {
                        label = "Users";
                        icon = <User className="h-4.5 w-4.5 shrink-0" />;
                      }

                      return (
                        <button
                          key={route.path}
                          type="button"
                          onClick={() => handleSimpleRouteSelect(route)}
                          className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-all ${
                            isActive
                              ? "bg-primary/15 text-primary border border-primary/20 font-semibold shadow-sm"
                              : "text-muted-foreground hover:bg-background/80 hover:text-foreground border border-transparent"
                          }`}
                        >
                          {icon}
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {customContentTypes.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2 px-2">
                      Custom content
                    </span>
                    <ScrollArea className="h-[200px] pr-1">
                      <div className="space-y-0.5 pr-2">
                        {customContentTypes.map((route) => {
                          const isActive = selectedRoute?.path === route.path;
                          const segments = route.path.split("/");
                          const cleanLabel = segments[segments.length - 1] || route.path;
                          
                          return (
                            <button
                              key={route.path}
                              type="button"
                              onClick={() => handleSimpleRouteSelect(route)}
                              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-all ${
                                isActive
                                  ? "bg-primary/15 text-primary border border-primary/20 font-semibold"
                                  : "text-muted-foreground hover:bg-background/80 hover:text-foreground border border-transparent"
                              }`}
                            >
                              <span className="truncate capitalize">{cleanLabel.replace(/_/g, " ")}</span>
                              <span className="text-xs opacity-60 font-mono scale-90">{route.namespace}</span>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Sidebar Mode Toggle & Theme Selection */}
            <div className="border-t border-border/25 pt-3 mt-auto space-y-2.5">
              {/* Advanced Mode Toggle */}
              <div className="flex items-center justify-between bg-background/30 rounded-lg border border-border/40 p-2.5 shadow-sm">
                <div className="flex flex-col gap-0.5 max-w-[80%]">
                  <span className="text-xs font-bold text-foreground">Advanced Mode</span>
                  <span className="text-[10px] text-muted-foreground leading-snug">Expose raw API routes and dynamic parameter forms</span>
                </div>
                <Switch
                  checked={isAdvancedMode}
                  onCheckedChange={(checked) => {
                    setIsAdvancedMode(checked);
                    setResponseData(null);
                    setMetrics(null);
                    setRequestError(null);
                    if (selectedRoute) {
                      const initialParams = {
                        page: "1",
                        per_page: "10",
                        _embed: "true",
                      };
                      setQueryParams(initialParams);
                      executeApiRequest(connection, selectedRoute, initialParams);
                    }
                  }}
                />
              </div>

              {/* System aware Theme Selector Segmented Control */}
              <div className="flex items-center justify-between bg-background/30 rounded-lg border border-border/40 p-2.5 shadow-sm">
                <span className="text-xs font-bold text-foreground">Theme</span>
                <div className="flex bg-muted/60 p-0.5 rounded-md border border-border/40">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleThemeChange("light")}
                    className={`h-7 w-8 rounded-sm p-0 transition-colors ${
                      theme === "light" 
                        ? "bg-background shadow-sm text-primary" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Light Mode"
                  >
                    <Sun className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleThemeChange("system")}
                    className={`h-7 w-8 rounded-sm p-0 transition-colors ${
                      theme === "system" 
                        ? "bg-background shadow-sm text-primary" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="System Preference"
                  >
                    <Laptop className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleThemeChange("dark")}
                    className={`h-7 w-8 rounded-sm p-0 transition-colors ${
                      theme === "dark" 
                        ? "bg-background shadow-sm text-primary" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Dark Mode"
                  >
                    <Moon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Panel */}
      <main className="flex-1 flex flex-col min-w-0 bg-background/25 overflow-y-auto p-4 md:p-6 space-y-5">
        {!connection ? (
          /* Dashboard Landing View */
          <div className="flex-grow flex items-center justify-center py-8">
            <div className="max-w-2xl text-center space-y-6">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/25 shadow-inner">
                <Database className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Client-Side WordPress Explorer</h2>
                <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Enter a WordPress URL in the selector sidebar or pick a bookmark to discover endpoints, build queries dynamically, and visual results instantly.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <Card className="border-border bg-card/30 backdrop-blur-sm">
                  <CardContent className="p-4 space-y-2">
                    <Sparkles className="h-5 w-5 text-primary mx-auto" />
                    <h4 className="text-xs font-bold">Content Inspector</h4>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Quickly browse posts, pages, images, and user accounts from any public WordPress site.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card/30 backdrop-blur-sm">
                  <CardContent className="p-4 space-y-2">
                    <Terminal className="h-5 w-5 text-indigo-400 mx-auto" />
                    <h4 className="text-xs font-bold">CORS Bypass Proxy</h4>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Route queries through our integrated proxy when servers lock down browser origin calls.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border bg-card/30 backdrop-blur-sm">
                  <CardContent className="p-4 space-y-2">
                    <Eye className="h-5 w-5 text-emerald-400 mx-auto" />
                    <h4 className="text-xs font-bold">Rich Visual Views</h4>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Renders complete blog layouts, galleries with downloads, and comment threads.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          /* Active Connection Workspace */
          <>
            {/* Active Connection Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/30 border border-border/40 rounded-lg p-4 backdrop-blur-md shadow-sm">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    {connection.schema.name || "WordPress Site"}
                  </h3>
                  <a
                    href={connection.schema.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center scale-90"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                {connection.schema.description && (
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {connection.schema.description}
                  </p>
                )}
                <span className="text-xs font-mono text-muted-foreground block">
                  Connected: {connection.apiRoot}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                className="h-9 text-sm text-muted-foreground hover:text-destructive hover:border-destructive/30 shrink-0 gap-1.5"
              >
                <Unlink className="h-4 w-4" />
                Disconnect
              </Button>
            </div>

            {selectedRoute && (
              <>
                {isAdvancedMode ? (
                  /* ADVANCED MODE: Exposes Raw console & Dynamic forms */
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
                      }}
                    />
                  </>
                ) : (
                  /* SIMPLE MODE: Clean Search & Pagination Toolbar */
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider block px-1">
                      Exploring {getRouteLabel(selectedRoute)}
                    </h3>
                    
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card/20 border border-border/40 rounded-lg p-3 backdrop-blur-md shadow-sm">
                      {/* Search Input */}
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder={`Search ${getRouteLabel(selectedRoute).toLowerCase()}...`}
                          value={queryParams.search || ""}
                          onChange={(e) => {
                            const newParams = { ...queryParams, search: e.target.value };
                            setQueryParams(newParams);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              executeApiRequest(connection, selectedRoute, queryParams);
                            }
                          }}
                          className="pl-9 bg-background/50 h-9.5 text-sm"
                        />
                      </div>

                      {/* Pagination Controls */}
                      <div className="flex items-center gap-3 justify-between md:justify-end shrink-0">
                        {/* Per Page Size Select */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground whitespace-nowrap">Show:</span>
                          <Select
                            value={queryParams.per_page || "10"}
                            onValueChange={(val) => {
                              const newParams = { ...queryParams, per_page: val || "10", page: "1" };
                              setQueryParams(newParams);
                              executeApiRequest(connection, selectedRoute, newParams);
                            }}
                          >
                            <SelectTrigger className="h-9.5 w-18 text-xs bg-background/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="25">25</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Page Numbers Navigation */}
                        <div className="flex items-center gap-2 border-l border-border/30 pl-3">
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={isLoading || parseInt(queryParams.page || "1", 10) <= 1}
                            onClick={() => {
                              const prevPage = Math.max(1, parseInt(queryParams.page || "1", 10) - 1);
                              const newParams = { ...queryParams, page: String(prevPage) };
                              setQueryParams(newParams);
                              executeApiRequest(connection, selectedRoute, newParams);
                            }}
                            className="h-9.5 w-9.5"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>

                          <span className="text-sm font-semibold text-foreground/80 min-w-[70px] text-center">
                            Page {queryParams.page || "1"} {metrics?.totalPages ? `of ${metrics.totalPages}` : ""}
                          </span>

                          <Button
                            variant="outline"
                            size="icon"
                            disabled={
                              isLoading || 
                              (metrics?.totalPages !== null && 
                               parseInt(queryParams.page || "1", 10) >= (metrics?.totalPages || 1))
                            }
                            onClick={() => {
                              const nextPage = parseInt(queryParams.page || "1", 10) + 1;
                              const newParams = { ...queryParams, page: String(nextPage) };
                              setQueryParams(newParams);
                              executeApiRequest(connection, selectedRoute, newParams);
                            }}
                            className="h-9.5 w-9.5"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Search Action Button */}
                        <Button
                          onClick={() => executeApiRequest(connection, selectedRoute, queryParams)}
                          disabled={isLoading}
                          className="h-9.5 text-sm"
                        >
                          Search
                        </Button>
                      </div>
                    </div>

                    {/* Collapsible developer detail cURL dashboard */}
                    <div className="border border-border/30 bg-card/10 rounded-lg p-3">
                      <button
                        type="button"
                        onClick={() => setShowDevConsole(!showDevConsole)}
                        className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <CodeIcon className="h-3.5 w-3.5 text-primary" />
                          Developer Tools (API Request details & cURL)
                        </span>
                        {showDevConsole ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>

                      {showDevConsole && (
                        <div className="mt-3 border-t border-border/20 pt-3 animate-in fade-in duration-200">
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
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Response Section */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 border border-border/30 rounded-lg bg-card/5">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground font-semibold">Loading content items...</span>
              </div>
            )}

            {requestError && (
              <div className="flex gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-xs text-destructive">
                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h5 className="font-bold text-sm">Fetch request failed</h5>
                  <p className="leading-relaxed text-xs">{requestError}</p>
                </div>
              </div>
            )}

            {responseData && !isLoading && (
              <div className="space-y-3">
                <Tabs defaultValue="visual" className="w-full">
                  <div className="flex items-center justify-between border-b border-border/20 pb-1.5 mb-3">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Database className="h-4 w-4 text-primary" />
                      WordPress Content Payload
                    </h3>
                    <TabsList className="bg-background/50 h-8.5 p-0.5 border border-border/30 rounded-md">
                      <TabsTrigger value="visual" className="text-xs py-1">
                        <Eye className="h-3.5 w-3.5 mr-1" /> Visual View
                      </TabsTrigger>
                      <TabsTrigger value="table" className="text-xs py-1">
                        <TableIcon className="h-3.5 w-3.5 mr-1" /> Data Grid
                      </TabsTrigger>
                      <TabsTrigger value="json" className="text-xs py-1">
                        <CodeIcon className="h-3.5 w-3.5 mr-1" /> Raw JSON
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
            )}
          </>
        )}
      </main>
    </div>
  );
}
