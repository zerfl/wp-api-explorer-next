"use client";

import { memo, useState } from "react";
import RouteNavigator from "@/components/RouteNavigator";
import { useExplorer } from "@/contexts/ExplorerContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FileText, Image as ImageIcon, Layers, Menu, MessageSquare, User } from "lucide-react";

function CollectionIcon({ slug }: { slug: string }) {
  const className = "h-4.5 w-4.5 shrink-0";
  if (slug === "media") return <ImageIcon className={className} aria-hidden="true" />;
  if (slug === "pages") return <Layers className={className} aria-hidden="true" />;
  if (slug === "comments") return <MessageSquare className={className} aria-hidden="true" />;
  if (slug === "users") return <User className={className} aria-hidden="true" />;
  return <FileText className={className} aria-hidden="true" />;
}

/**
 * The collection navigation content, shared by the desktop sidebar and the
 * mobile drawer. `onNavigate` lets the drawer close itself after a selection.
 */
export function CollectionNav({ onNavigate }: { onNavigate?: () => void }) {
  const {
    state: { routes, selectedRoute, isAdvancedMode },
    actions: { navigateCollection, selectRoute },
    meta: { selectedCollection, coreCollections, customCollections },
  } = useExplorer();

  if (isAdvancedMode) {
    return (
      <RouteNavigator
        routes={routes}
        selectedRoute={selectedRoute?.path || ""}
        onSelectRoute={(route) => {
          selectRoute(route);
          onNavigate?.();
        }}
      />
    );
  }

  const collectionButtonClass = (isActive: boolean) =>
    `flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
      isActive
        ? "border-primary/25 bg-primary/10 font-semibold text-primary"
        : "border-transparent text-muted-foreground hover:border-border/40 hover:bg-background/70 hover:text-foreground"
    }`;

  return (
    <nav
      aria-label="Collections"
      className="flex h-full flex-col gap-4 rounded-xl border border-border/40 bg-card/20 p-4 backdrop-blur-md"
    >
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
                aria-current={isActive ? "true" : undefined}
                onClick={() => {
                  void navigateCollection(collection);
                  onNavigate?.();
                }}
                className={collectionButtonClass(isActive)}
              >
                <CollectionIcon slug={collection.slug} />
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
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => {
                        void navigateCollection(collection);
                        onNavigate?.();
                      }}
                      className={`${collectionButtonClass(isActive)} justify-between`}
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
    </nav>
  );
}

function CollectionSidebarComponent() {
  const {
    state: { connection },
  } = useExplorer();

  if (!connection) {
    return null;
  }

  return (
    <aside className="hidden w-[280px] shrink-0 border-r border-border/40 bg-card/10 p-4 lg:block">
      <CollectionNav />
    </aside>
  );
}

const CollectionSidebar = memo(CollectionSidebarComponent);

export default CollectionSidebar;

/**
 * Mobile-only trigger + drawer exposing the same collection navigation. Rendered
 * in the header so small-screen users can switch collections (the desktop
 * sidebar is hidden below lg).
 */
export function MobileCollectionsNav() {
  const {
    state: { connection },
  } = useExplorer();
  const [open, setOpen] = useState(false);

  if (!connection) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open collections menu"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/50 text-muted-foreground transition-colors hover:bg-background hover:text-foreground lg:hidden"
      >
        <Menu className="h-4.5 w-4.5" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] bg-card">
        <SheetTitle className="sr-only">Collections</SheetTitle>
        <CollectionNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
