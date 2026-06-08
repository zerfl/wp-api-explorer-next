import { WpRouteInfo } from "@/lib/wp-schema";

export const DEFAULT_PER_PAGE = "100";
export const THEME_STORAGE_KEY = "wp-api-explorer.theme";
export const PER_PAGE_STORAGE_KEY = "wp-api-explorer.per-page";
export const CONNECTION_STORAGE_KEY = "wp-api-explorer.connection";

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

export function parseExplorerPath(pathname: string): ExplorerBookmark | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "site" || segments.length < 4) {
    return null;
  }

  return parseExplorerSegments(segments.slice(1));
}

export function parseExplorerSegments(segments: string[]): ExplorerBookmark | null {
  if (segments.length < 3) {
    return null;
  }

  const decodedSegments = segments.map((segment) => decodeURIComponent(segment));
  const pageSegment = decodedSegments.at(-1);
  const contentType = decodedSegments.at(-2);
  const siteSegments = decodedSegments.slice(0, -2);

  if (!pageSegment || !contentType || siteSegments.length === 0) {
    return null;
  }

  const pageNumber = Number.parseInt(pageSegment, 10);
  const page = Number.isFinite(pageNumber) && pageNumber > 0 ? String(pageNumber) : "1";

  return {
    siteUrl: `https://${siteSegments.join("/")}`,
    contentType,
    page,
  };
}

export function buildExplorerPath({ siteUrl, contentType, page }: ExplorerBookmark): string {
  const normalizedUrl = normalizeSiteUrl(siteUrl);
  const url = new URL(normalizedUrl);
  const siteSegments = [url.host, ...url.pathname.split("/").filter(Boolean)].map((segment) =>
    encodeURIComponent(segment)
  );

  return `/site/${siteSegments.join("/")}/${encodeURIComponent(contentType)}/${encodeURIComponent(page)}`;
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
