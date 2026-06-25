"use client";

import { createContext, useContext } from "react";
import { ContentCollection } from "@/lib/explorer";
import { ConnectToSiteOptions, SiteConnection } from "@/lib/explorer-client";
import { WpRouteInfo } from "@/lib/wp-schema";

export interface ExplorerState {
  connection: SiteConnection | null;
  routes: WpRouteInfo[];
  collections: ContentCollection[];
  selectedRoute: WpRouteInfo | null;
  isAdvancedMode: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  /** Non-error info banner (e.g. "switched to proxy mode because of CORS"). */
  connectionNotice: string | null;
  /** A connect attempt failed because of CORS; offer a "Retry with proxy" action. */
  corsRetryAvailable: boolean;
  /** User preference: auto-fall back to the proxy when a site blocks CORS. */
  autoProxy: boolean;
}

export interface ExplorerActions {
  connectToSite: (options: ConnectToSiteOptions) => Promise<void>;
  disconnect: () => void;
  selectRoute: (route: WpRouteInfo) => void;
  navigateCollection: (collection: ContentCollection, page?: string) => Promise<void>;
  setAdvancedMode: (enabled: boolean) => void;
  syncCurrentBookmark: (page: string, mode: "push" | "replace") => void;
  /** Replay the last connect attempt through the proxy. */
  retryWithProxy: () => void;
  dismissConnectionNotice: () => void;
  setAutoProxy: (enabled: boolean) => void;
}

export interface ExplorerMeta {
  selectedCollection: ContentCollection | null;
  coreCollections: ContentCollection[];
  customCollections: ContentCollection[];
  getRouteLabel: (route: WpRouteInfo) => string;
  suggestedSiteUrl: string;
  bookmarkContentType: string | null;
}

export interface ExplorerContextValue {
  state: ExplorerState;
  actions: ExplorerActions;
  meta: ExplorerMeta;
}

const ExplorerContext = createContext<ExplorerContextValue | null>(null);

export function useExplorer() {
  const context = useContext(ExplorerContext);
  if (!context) {
    throw new Error("useExplorer must be used within ExplorerProvider.");
  }

  return context;
}

export { ExplorerContext };
