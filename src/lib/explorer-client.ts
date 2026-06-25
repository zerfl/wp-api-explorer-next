"use client";

import {
  AUTO_PROXY_STORAGE_KEY,
  CONNECTION_STORAGE_KEY,
  DEFAULT_PER_PAGE,
  PER_PAGE_STORAGE_KEY,
} from "@/lib/explorer";
import { WpRouteInfo, WpSchema } from "@/lib/wp-schema";

export type ExplorerTheme = "light" | "dark" | "system";

export interface SiteConnection {
  siteUrl: string;
  apiRoot: string;
  schema: WpSchema;
  useProxy: boolean;
  auth: { username: string; appPassword: string } | null;
}

export interface StoredConnectionSnapshot {
  siteUrl: string;
  useProxy: boolean;
  auth: { username: string; appPassword: string } | null;
}

export interface ResponseMetrics {
  status: number | null;
  statusText: string;
  timeMs: number | null;
  totalRecords: number | null;
  totalPages: number | null;
}

export interface ConnectToSiteOptions {
  siteUrl: string;
  useProxy: boolean;
  auth: { username: string; appPassword: string } | null;
  desiredContentType?: string;
  desiredPage?: string;
  desiredRoutePath?: string;
  navigationMode: "push" | "replace";
}

export const applyTheme = (activeTheme: ExplorerTheme) => {
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

export const getStoredPerPage = () => {
  if (typeof window === "undefined") {
    return DEFAULT_PER_PAGE;
  }

  return localStorage.getItem(PER_PAGE_STORAGE_KEY) || DEFAULT_PER_PAGE;
};

export const getStoredAutoProxy = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return localStorage.getItem(AUTO_PROXY_STORAGE_KEY) === "true";
};

export const persistAutoProxy = (enabled: boolean) => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(AUTO_PROXY_STORAGE_KEY, enabled ? "true" : "false");
};

export const getStoredConnection = (): StoredConnectionSnapshot | null => {
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

export const persistConnection = (connection: StoredConnectionSnapshot | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!connection) {
    window.sessionStorage.removeItem(CONNECTION_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(connection));
};

export const getRouteArgs = (route: WpRouteInfo | null) => route?.endpoints?.[0]?.args || {};

export const buildBaseQueryParams = (
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

export const isMediaRoute = (routePath: string) => routePath.endsWith("/media");

/**
 * Pull a human-readable error message out of a WordPress REST error body.
 * WordPress returns `{ code, message }`; the proxy returns `{ error, details }`.
 * Returns null when the body isn't JSON or carries no recognizable message.
 */
export const extractWpErrorMessage = (body: string | null): string | null => {
  if (!body) {
    return null;
  }

  try {
    const json: unknown = JSON.parse(body);
    if (json && typeof json === "object") {
      const record = json as Record<string, unknown>;
      if (typeof record.message === "string" && record.message.trim()) {
        return record.message;
      }
      if (typeof record.error === "string" && record.error.trim()) {
        return record.error;
      }
    }
  } catch {
    // Body is not JSON — nothing to extract.
  }

  return null;
};
