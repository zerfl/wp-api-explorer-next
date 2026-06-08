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
}

export interface ExplorerActions {
  connectToSite: (options: ConnectToSiteOptions) => Promise<void>;
  disconnect: () => void;
  selectRoute: (route: WpRouteInfo) => void;
  navigateCollection: (collection: ContentCollection, page?: string) => Promise<void>;
  setAdvancedMode: (enabled: boolean) => void;
  syncCurrentBookmark: (page: string, mode: "push" | "replace") => void;
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
