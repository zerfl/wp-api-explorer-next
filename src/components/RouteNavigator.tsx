"use client";

import React, { useState, useMemo } from "react";
import { WpRouteInfo } from "@/lib/wp-schema";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FolderGit2, Hash, ArrowRight } from "lucide-react";

interface RouteNavigatorProps {
  routes: WpRouteInfo[];
  selectedRoute: string;
  onSelectRoute: (route: WpRouteInfo) => void;
}

export default function RouteNavigator({
  routes,
  selectedRoute,
  onSelectRoute,
}: RouteNavigatorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedNamespaces, setCollapsedNamespaces] = useState<Record<string, boolean>>({});

  const toggleNamespace = (ns: string) => {
    setCollapsedNamespaces((prev) => ({
      ...prev,
      [ns]: !prev[ns],
    }));
  };

  // Filter and group routes by namespace
  const groupedRoutes = useMemo(() => {
    const filtered = routes.filter((r) =>
      r.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.namespace.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const groups: Record<string, WpRouteInfo[]> = {};
    filtered.forEach((route) => {
      const ns = route.namespace;
      if (!groups[ns]) {
        groups[ns] = [];
      }
      groups[ns].push(route);
    });

    // Sort namespaces: put core wp/v2 first, then others alphabetically
    return Object.keys(groups)
      .sort((a, b) => {
        if (a === "wp/v2") return -1;
        if (b === "wp/v2") return 1;
        if (a === "index") return -1;
        if (b === "index") return 1;
        return a.localeCompare(b);
      })
      .reduce<Record<string, WpRouteInfo[]>>((acc, key) => {
        acc[key] = groups[key].sort((a, b) => a.path.localeCompare(b.path));
        return acc;
      }, {});
  }, [routes, searchQuery]);

  const totalRoutesCount = routes.length;
  const filteredCount = Object.values(groupedRoutes).reduce((sum, list) => sum + list.length, 0);

  return (
    <div className="flex flex-col h-full space-y-3 bg-card/10 border border-border/40 rounded-lg p-3.5 backdrop-blur-md">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <FolderGit2 className="h-4.5 w-4.5 text-primary" />
            API Endpoints
          </h3>
          <Badge variant="outline" className="text-xs px-2 py-0 font-semibold">
            {filteredCount === totalRoutesCount 
              ? totalRoutesCount 
              : `${filteredCount}/${totalRoutesCount}`}
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filter endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9.5 text-sm bg-background/50 border-border/60"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 pr-1 -mr-2">
        <div className="space-y-3 pr-2">
          {Object.entries(groupedRoutes).map(([ns, nsRoutes]) => {
            const isCollapsed = collapsedNamespaces[ns];
            return (
              <div key={ns} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => toggleNamespace(ns)}
                  className="flex w-full items-center justify-between py-1 text-left hover:text-foreground transition-colors group"
                >
                  <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground flex items-center gap-1 uppercase tracking-wider">
                    {ns === "index" ? "⚡ API Directory Index" : ns}
                  </span>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 scale-90 font-semibold">
                    {nsRoutes.length}
                  </Badge>
                </button>

                {!isCollapsed && (
                  <div className="space-y-0.5 border-l border-border/30 pl-2.5 ml-1 mt-1 transition-all duration-200">
                    {nsRoutes.map((route) => {
                      const isActive = selectedRoute === route.path;
                      const cleanLabel = route.path.startsWith("/" + ns)
                        ? route.path.substring(ns.length + 1)
                        : route.path;
                      
                      return (
                        <button
                          key={route.path}
                          type="button"
                          onClick={() => onSelectRoute(route)}
                          className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs transition-all ${
                            isActive
                              ? "bg-primary/15 text-primary border border-primary/20 font-semibold"
                              : "text-muted-foreground hover:bg-background/80 hover:text-foreground border border-transparent"
                          }`}
                        >
                          <span className="truncate flex items-center gap-1">
                            <Hash className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground/60"}`} />
                            {cleanLabel === "/" || cleanLabel === "" ? "/" : cleanLabel}
                          </span>
                          {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary animate-pulse" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {filteredCount === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No matching endpoints found
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
