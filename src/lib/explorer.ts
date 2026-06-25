import type { WpRouteInfo } from "@/lib/wp-schema";

export const DEFAULT_PER_PAGE = "100";
export const THEME_STORAGE_KEY = "wp-api-explorer.theme";
export const PER_PAGE_STORAGE_KEY = "wp-api-explorer.per-page";
export const CONNECTION_STORAGE_KEY = "wp-api-explorer.connection";
export const AUTO_PROXY_STORAGE_KEY = "wp-api-explorer.auto-proxy";

/** Upper bound on how many parent paths we probe when walking up to the install root. */
export const MAX_ROOT_CANDIDATES = 5;

export interface ExplorerBookmark {
  siteUrl: string;
  contentType: string;
  page: string;
}

export interface ContentCollection {
  slug: string;
  label: string;
  routePath: string;
  namespace: string;
  isCore: boolean;
}

export interface WpTypeDefinition {
  slug?: string;
  name?: string;
  rest_base?: string;
  rest_namespace?: string;
  viewable?: boolean;
}

const CORE_COLLECTIONS = [
  { slug: "posts", label: "Posts", routePath: "/wp/v2/posts" },
  { slug: "pages", label: "Pages", routePath: "/wp/v2/pages" },
  { slug: "media", label: "Media", routePath: "/wp/v2/media" },
  { slug: "comments", label: "Comments", routePath: "/wp/v2/comments" },
  { slug: "users", label: "Users", routePath: "/wp/v2/users" },
] as const;

const RESERVED_TYPE_SLUGS = new Set(["post", "page", "attachment"]);

/**
 * Encodes a bookmark as a query string on the app root, e.g.
 * `/?site=https://example.com/blog&type=posts&page=2`.
 *
 * The whole site URL — including any subdirectory install path — is carried in a
 * single `site` value, so it never collides with the target site's own path
 * structure (a WordPress install at `example.com/site/` round-trips cleanly).
 */
export function buildExplorerUrl({ siteUrl, contentType, page }: ExplorerBookmark): string {
  const params = new URLSearchParams();
  params.set("site", normalizeSiteUrl(siteUrl));
  params.set("type", contentType);
  params.set("page", page);
  return `/?${params.toString()}`;
}

/**
 * Parses a bookmark from a query string. Accepts a bare `location.search`
 * (`?site=…` or `site=…`) or a full `/?site=…` path — everything up to and
 * including the first `?` is ignored. Returns null when `site`/`type` are absent.
 */
export function parseExplorerQuery(search: string): ExplorerBookmark | null {
  const queryStart = search.indexOf("?");
  const query = queryStart === -1 ? search : search.slice(queryStart + 1);
  const params = new URLSearchParams(query);
  const siteUrl = params.get("site");
  const contentType = params.get("type");
  if (!siteUrl || !contentType) {
    return null;
  }

  const pageNumber = Number.parseInt(params.get("page") ?? "1", 10);
  const page = Number.isFinite(pageNumber) && pageNumber > 0 ? String(pageNumber) : "1";

  return { siteUrl, contentType, page };
}

/**
 * Turns a normalized site URL into an ordered list of candidate install roots,
 * deepest path first and the bare host last. Walking deepest-first means a genuine
 * subdirectory install (e.g. `example.com/site`) is matched before the host root,
 * while a pasted post permalink (e.g. `example.com/some-post`) falls through to the
 * host root once the deeper probes 404. Capped at MAX_ROOT_CANDIDATES.
 */
export function buildRootCandidates(normalizedSiteUrl: string): string[] {
  const url = new URL(normalizedSiteUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  const candidates: string[] = [];

  for (
    let depth = segments.length;
    depth >= 0 && candidates.length < MAX_ROOT_CANDIDATES;
    depth -= 1
  ) {
    const path = segments.slice(0, depth).join("/");
    candidates.push(`${url.protocol}//${url.host}${path ? `/${path}` : ""}`);
  }

  return candidates;
}

export function normalizeSiteUrl(siteUrl: string): string {
  const trimmed = siteUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = "";
  url.search = "";

  const normalizedPath = normalizePathname(url.pathname);
  url.pathname = normalizedPath === "/" ? "/" : normalizedPath.replace(/\/+$/, "");

  return `${url.protocol}//${url.host}${url.pathname === "/" ? "" : url.pathname}`;
}

function normalizePathname(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "/";
  }

  const internalSegmentIndex = segments.findIndex((segment) =>
    ["wp-admin", "wp-content", "wp-includes", "wp-json"].includes(segment)
  );

  if (internalSegmentIndex !== -1) {
    return internalSegmentIndex === 0 ? "/" : `/${segments.slice(0, internalSegmentIndex).join("/")}`;
  }

  const lastSegment = segments.at(-1) || "";
  if (
    /\.[a-z0-9]+$/i.test(lastSegment) ||
    lastSegment === "index.php" ||
    lastSegment === "xmlrpc.php"
  ) {
    return segments.length === 1 ? "/" : `/${segments.slice(0, -1).join("/")}`;
  }

  return pathname.replace(/\/+$/, "") || "/";
}

export function getCoreCollections(routes: WpRouteInfo[]): ContentCollection[] {
  return CORE_COLLECTIONS.flatMap((collection) => {
    const route = routes.find((candidate) => candidate.path === collection.routePath);
    if (!route) {
      return [];
    }

    return [
      {
        slug: collection.slug,
        label: collection.label,
        routePath: route.path,
        namespace: route.namespace,
        isCore: true,
      },
    ];
  });
}

export function getCustomCollections(
  routes: WpRouteInfo[],
  typeIndex: Record<string, WpTypeDefinition> | null
): ContentCollection[] {
  if (!typeIndex) {
    return [];
  }

  return Object.values(typeIndex)
    .filter((typeDef) => Boolean(typeDef.viewable && typeDef.rest_base))
    .filter((typeDef) => !RESERVED_TYPE_SLUGS.has(typeDef.slug || ""))
    .flatMap((typeDef) => {
      const namespace = typeDef.rest_namespace || "wp/v2";
      const routePath = resolveRoutePath(routes, typeDef.rest_base || "", namespace);
      if (!routePath) {
        return [];
      }

      return [
        {
          slug: typeDef.rest_base || "",
          label: typeDef.name || humanizeSegment(typeDef.rest_base || ""),
          routePath,
          namespace,
          isCore: false,
        },
      ];
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function findCollectionBySlug(
  collections: ContentCollection[],
  contentType: string
): ContentCollection | null {
  return collections.find((collection) => collection.slug === contentType) || null;
}

export function findCollectionByRoutePath(
  collections: ContentCollection[],
  routePath: string
): ContentCollection | null {
  return collections.find((collection) => collection.routePath === routePath) || null;
}

export function humanizeSegment(segment: string): string {
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function resolveRoutePath(routes: WpRouteInfo[], restBase: string, namespace: string): string | null {
  const directPath = `/${namespace}/${restBase}`;
  const directRoute = routes.find((route) => route.path === directPath);
  if (directRoute) {
    return directRoute.path;
  }

  const fallbackRoute = routes.find((route) => route.path.endsWith(`/${restBase}`));
  return fallbackRoute?.path || null;
}
