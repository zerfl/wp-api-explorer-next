"use client";

import type React from "react";
import { createContext, useContext } from "react";
import { ResponseMetrics } from "@/lib/explorer-client";
import type { HttpFailureKind } from "@/lib/http";
import type { WalkEvent } from "@/lib/windowed-walk";
import { WpRouteInfo } from "@/lib/wp-schema";

export interface RequestFailure {
  kind: HttpFailureKind;
  status: number | null;
}

export interface WindowProgress {
  active: boolean;
  batch: number;
  itemsCollected: number;
  walkedTo: string | null;
  done: boolean;
  hasMore: boolean;
  log: WalkEvent[];
}

export interface RequestState {
  queryParams: Record<string, string>;
  isLoading: boolean;
  responseData: unknown;
  requestError: string | null;
  requestFailure: RequestFailure | null;
  metrics: ResponseMetrics | null;
  windowedMode: boolean;
  windowProgress: WindowProgress | null;
}

export interface RequestActions {
  setQueryParams: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  executeCurrentRequest: (paramsOverride?: Record<string, string>) => Promise<void>;
  resetForRoute: (route: WpRouteInfo, overrides?: Record<string, string>) => Record<string, string>;
  changePerPage: (value: string | null) => Promise<void>;
  setWindowedMode: (enabled: boolean) => void;
  stopWindowedWalk: () => void;
}

export interface RequestMeta {
  constructedUrl: string;
}

export interface RequestContextValue {
  state: RequestState;
  actions: RequestActions;
  meta: RequestMeta;
}

const RequestContext = createContext<RequestContextValue | null>(null);

export function useRequest() {
  const context = useContext(RequestContext);
  if (!context) {
    throw new Error("useRequest must be used within ExplorerProvider.");
  }

  return context;
}

export { RequestContext };
