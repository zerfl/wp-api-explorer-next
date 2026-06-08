"use client";

import { memo } from "react";
import RouteNavigator from "@/components/RouteNavigator";
import { useExplorer } from "@/contexts/ExplorerContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Image as ImageIcon, Layers, MessageSquare, User } from "lucide-react";

function CollectionSidebarComponent() {
  const {
    state: { connection, routes, selectedRoute, isAdvancedMode },
    actions: { navigateCollection, selectRoute },
    meta: { selectedCollection, coreCollections, customCollections },
  } = useExplorer();

  if (!connection) {
    return null;
  }

  return (
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
  );
}

const CollectionSidebar = memo(CollectionSidebarComponent);

export default CollectionSidebar;
