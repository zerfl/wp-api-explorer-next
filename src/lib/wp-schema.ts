import { httpRequest } from "@/lib/http";
import { buildRootCandidates, normalizeSiteUrl } from "@/lib/explorer";

export interface WpArg {
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  items?: { type: string; enum?: unknown[] };
}

export interface WpEndpoint {
  methods: string[];
  args?: Record<string, WpArg>;
}

export interface WpRouteInfo {
  path: string;
  namespace: string;
  endpoints: WpEndpoint[];
}

export interface WpSchema {
  name: string;
  description: string;
  url: string;
  namespaces: string[];
  routes: Record<string, { endpoints: WpEndpoint[] }>;
}

const DEFAULT_PER_PAGE = 100;

// Default fallback endpoints if a site has disabled the schema index
export const CORE_FALLBACK_ROUTES: Record<string, WpRouteInfo> = {
  "/wp/v2/posts": {
    path: "/wp/v2/posts",
    namespace: "wp/v2",
    endpoints: [
      {
        methods: ["GET"],
        args: {
          page: { type: "integer", default: 1, description: "Current page of the collection." },
          per_page: { type: "integer", default: DEFAULT_PER_PAGE, description: "Maximum number of items to be returned in result set." },
          search: { type: "string", description: "Limit results to those matching a string." },
          after: { type: "string", description: "Limit response to posts published after a given ISO8601 compliant date." },
          author: { type: "array", items: { type: "integer" }, description: "Limit result set to posts assigned to specific authors." },
          categories: { type: "array", items: { type: "integer" }, description: "Limit result set to all items that have the specified term assigned in the categories taxonomy." },
          tags: { type: "array", items: { type: "integer" }, description: "Limit result set to all items that have the specified term assigned in the tags taxonomy." },
          sticky: { type: "boolean", description: "Limit result set to items that are sticky." },
          orderby: { type: "string", enum: ["author", "date", "id", "include", "modified", "parent", "relevance", "slug", "title"], default: "date", description: "Sort collection by object attribute." },
          order: { type: "string", enum: ["asc", "desc"], default: "desc", description: "Order sort attribute ascending or descending." },
          status: { type: "string", enum: ["publish", "future", "draft", "pending", "private"], default: "publish", description: "Limit result set to posts assigned one or more statuses." },
          _embed: { type: "boolean", description: "Embed detailed representations of associated objects (author, categories, etc.)" }
        }
      }
    ]
  },
  "/wp/v2/pages": {
    path: "/wp/v2/pages",
    namespace: "wp/v2",
    endpoints: [
      {
        methods: ["GET"],
        args: {
          page: { type: "integer", default: 1, description: "Current page of the collection." },
          per_page: { type: "integer", default: DEFAULT_PER_PAGE, description: "Maximum number of items..." },
          search: { type: "string", description: "Limit results to those matching a string." },
          parent: { type: "integer", description: "Limit result set to pages of this parent ID." },
          orderby: { type: "string", enum: ["author", "date", "id", "include", "modified", "parent", "relevance", "slug", "title", "menu_order"], default: "date", description: "Sort collection by object attribute." },
          order: { type: "string", enum: ["asc", "desc"], default: "desc" },
          status: { type: "string", enum: ["publish", "future", "draft", "pending", "private"], default: "publish" },
          _embed: { type: "boolean", description: "Embed associated objects" }
        }
      }
    ]
  },
  "/wp/v2/media": {
    path: "/wp/v2/media",
    namespace: "wp/v2",
    endpoints: [
      {
        methods: ["GET"],
        args: {
          page: { type: "integer", default: 1 },
          per_page: { type: "integer", default: DEFAULT_PER_PAGE },
          search: { type: "string" },
          parent: { type: "integer", description: "Limit result set to items attached to this post ID." },
          media_type: { type: "string", enum: ["image", "video", "audio", "application", "text"], description: "Limit results to specific media types." },
          mime_type: { type: "string", description: "Limit results to specific MIME types." },
          _embed: { type: "boolean", description: "Embed associated objects" }
        }
      }
    ]
  },
  "/wp/v2/comments": {
    path: "/wp/v2/comments",
    namespace: "wp/v2",
    endpoints: [
      {
        methods: ["GET"],
        args: {
          page: { type: "integer", default: 1 },
          per_page: { type: "integer", default: DEFAULT_PER_PAGE },
          search: { type: "string" },
          post: { type: "integer", description: "Limit results to those affiliated with this post ID." },
          author_email: { type: "string", description: "Limit results to those from specific author email." },
          status: { type: "string", enum: ["approve", "hold", "spam", "trash"], default: "approve" }
        }
      }
    ]
  },
  "/wp/v2/users": {
    path: "/wp/v2/users",
    namespace: "wp/v2",
    endpoints: [
      {
        methods: ["GET"],
        args: {
          page: { type: "integer", default: 1 },
          per_page: { type: "integer", default: DEFAULT_PER_PAGE },
          search: { type: "string" },
          roles: { type: "array", items: { type: "string" }, description: "Limit results to users matching specific roles." }
        }
      }
    ]
  },
  "/wp/v2/categories": {
    path: "/wp/v2/categories",
    namespace: "wp/v2",
    endpoints: [
      {
        methods: ["GET"],
        args: {
          page: { type: "integer", default: 1 },
          per_page: { type: "integer", default: DEFAULT_PER_PAGE },
          search: { type: "string" },
          parent: { type: "integer" }
        }
      }
    ]
  },
  "/wp/v2/tags": {
    path: "/wp/v2/tags",
    namespace: "wp/v2",
    endpoints: [
      {
        methods: ["GET"],
        args: {
          page: { type: "integer", default: 1 },
          per_page: { type: "integer", default: DEFAULT_PER_PAGE },
          search: { type: "string" }
        }
      }
    ]
  }
};

/**
 * Normalizes routes from a /wp-json/ schema object:
 * - Keeps only paths supporting GET
 * - Groups them by namespace
 * - Filters out parameterized single-item routes (e.g. /wp/v2/posts/(?P<id>[\d]+))
 *   so we only present clean collection endpoints.
 */
export function parseWpSchema(schema: WpSchema): WpRouteInfo[] {
  if (!schema || !schema.routes) return Object.values(CORE_FALLBACK_ROUTES);

  const routeList: WpRouteInfo[] = [];

  for (const [path, data] of Object.entries(schema.routes)) {
    // 1. Skip endpoints that don't support GET
    const getEndpoint = data.endpoints.find((ep) => ep.methods.includes("GET"));
    if (!getEndpoint) continue;

    // 2. Skip parameterized routes representing single items (contains regex parameters)
    // WordPress route definitions use regex groups like (?P<id>[\d]+) or <id>
    const isSingleItemRoute = path.includes("(?P<") || path.includes("<") || path.endsWith("/index");
    if (isSingleItemRoute) continue;

    // 3. Determine namespace
    // Standard namespaces: "wp/v2", "yoast/v1", etc.
    // The root "/" namespace is for the index itself.
    let namespace = "core";
    for (const ns of schema.namespaces || []) {
      if (path.startsWith("/" + ns)) {
        namespace = ns;
        break;
      }
    }

    if (path === "/") {
      namespace = "index";
    }

    routeList.push({
      path,
      namespace,
      endpoints: [getEndpoint]
    });
  }

  // If we couldn't parse any routes, fall back to core endpoints
  if (routeList.length === 0) {
    return Object.values(CORE_FALLBACK_ROUTES);
  }

  return routeList;
}

/**
 * Outcome of WordPress REST API discovery. Policy-free: the caller decides what to do
 * with a `cors` result (auto-fall back to the proxy, or prompt the user), and the UI
 * renders the precise message for the failure variants.
 */
export type DiscoverResult =
  | { status: "ok"; siteUrl: string; apiRoot: string; schema: WpSchema; usedProxy: boolean }
  | { status: "cors"; siteUrl: string; apiRoot: string; schema: WpSchema }
  | { status: "not-found"; message: string }
  | { status: "not-wordpress"; message: string }
  | { status: "unreachable"; message: string }
  | { status: "invalid-url"; message: string };

const NOT_FOUND_MESSAGE =
  "No WordPress REST API was found at this URL or any parent path. Double-check the address — the REST API may be disabled, or this may not be a WordPress site.";
const NOT_WORDPRESS_MESSAGE =
  "This site responded, but does not expose a WordPress REST API. It may not be a WordPress site.";
const UNREACHABLE_MESSAGE =
  "The site could not be reached. Check the URL and your connection — the host may be down or the domain misspelled.";
const INVALID_URL_MESSAGE =
  "That doesn't look like a valid URL. Check the site address and try again.";

/** The two endpoint shapes a WordPress REST index can live at, for a given site base. */
function apiRootsFor(base: string): string[] {
  return [`${base}/wp-json`, `${base}/index.php?rest_route=/`];
}

/** Parse a response body into a WpSchema if it looks like a WordPress REST index. */
function toWpSchema(text: string, fallbackUrl: string): WpSchema | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }

  if (json && typeof json === "object" && "routes" in json) {
    const schema = json as Record<string, unknown>;
    return {
      name: (schema.name as string) || "WordPress Site",
      description: (schema.description as string) || "",
      url: (schema.url as string) || fallbackUrl,
      namespaces: (schema.namespaces as string[]) || [],
      routes: schema.routes as WpSchema["routes"],
    };
  }

  return null;
}

/** Is `ancestor` the same path as, or a parent directory of, `descendant`? */
function isPathAncestor(ancestor: string, descendant: string): boolean {
  const a = ancestor.replace(/\/+$/, "");
  const d = descendant.replace(/\/+$/, "");
  return d === a || d.startsWith(`${a}/`);
}

/**
 * The WordPress REST index self-reports the install's own root in its `url` field.
 * Prefer it over the probed path. A deep URL (e.g. a pasted permalink) can answer at
 * `<deep>/index.php?rest_route=/` because WordPress rewrites the unknown path to the
 * root `index.php`, which otherwise makes deepest-first discovery anchor to the
 * permalink. The reported root is then a path-ancestor of the probe — collapse to it,
 * re-anchoring the endpoint form that actually answered. Genuine subdirectory installs
 * report their own (deeper) root and are preserved. Reports on a different origin, or
 * that aren't an ancestor of the probe, are ignored for safety.
 */
function canonicalInstallRoot(
  base: string,
  apiRoot: string,
  reportedUrl: string
): { siteUrl: string; apiRoot: string } {
  try {
    const reported = normalizeSiteUrl(reportedUrl);
    if (
      reported !== base &&
      new URL(reported).origin === new URL(base).origin &&
      isPathAncestor(new URL(reported).pathname, new URL(base).pathname)
    ) {
      return { siteUrl: reported, apiRoot: `${reported}${apiRoot.slice(base.length)}` };
    }
  } catch {
    // Unparseable self-report — fall back to the probed base.
  }
  return { siteUrl: base, apiRoot };
}

interface WalkResult {
  found: { siteUrl: string; apiRoot: string; schema: WpSchema } | null;
  /** We received a real upstream HTTP response from some candidate (e.g. a 404). */
  reachedServer: boolean;
  /** A candidate returned 2xx that wasn't a WordPress index. */
  gotNonWpSuccess: boolean;
  /**
   * A host-level transport failure occurred (direct network/timeout — i.e. possible
   * CORS or host down; or, via the proxy, the proxy could not reach the upstream host).
   * Because every candidate shares one origin, this is decisive for the whole host.
   */
  transportFailure: boolean;
}

/**
 * Probe candidate roots (deepest path → host root) over one transport. Keeps walking
 * past path-level 404s and instant network failures (a cross-origin probe of a
 * non-REST path — e.g. `/some-post/wp-json` — is CORS-blocked into a `network`
 * failure even though the shallower real `/wp-json` sends CORS headers and succeeds).
 * Bails early only on a timeout/abort, where retrying every parent would just stall.
 */
async function walkCandidates(candidates: string[], useProxy: boolean): Promise<WalkResult> {
  let reachedServer = false;
  let gotNonWpSuccess = false;
  let transportFailure = false;

  for (const base of candidates) {
    for (const apiRoot of apiRootsFor(base)) {
      const fetchUrl = useProxy ? `/api/proxy?url=${encodeURIComponent(apiRoot)}` : apiRoot;
      // Connecting is the critical step, so allow a longer timeout and one retry.
      // httpRequest never throws — it returns a discriminated result.
      const result = await httpRequest(fetchUrl, { timeoutMs: 20000, retries: 1 });

      if (result.ok) {
        const schema = toWpSchema(result.text, base);
        if (schema) {
          const install = canonicalInstallRoot(base, apiRoot, schema.url);
          return { found: { ...install, schema }, reachedServer: true, gotNonWpSuccess, transportFailure: false };
        }
        // 2xx, but not a WordPress index.
        reachedServer = true;
        gotNonWpSuccess = true;
        continue;
      }

      if (result.kind === "http") {
        // The proxy reports an upstream it couldn't reach as a 502 of its own.
        if (useProxy && result.status === 502) {
          return { found: null, reachedServer, gotNonWpSuccess, transportFailure: true };
        }
        // Any other real status (404, 403, 500…) means the host answered — keep walking.
        reachedServer = true;
        continue;
      }

      // A transport-level failure: the browser/proxy never got an HTTP response.
      transportFailure = true;

      // timeout | aborted: the host is slow or unreachable, so retrying each parent
      // path would just stall (20s apiece). Bail and let the proxy diagnose.
      if (result.kind === "timeout" || result.kind === "aborted") {
        return { found: null, reachedServer, gotNonWpSuccess, transportFailure: true };
      }

      // network: fails instantly and is ambiguous — a genuine CORS block on the whole
      // origin, OR just a non-REST path that carries no CORS header. Keep walking up:
      // the real REST root (`/wp-json`) may answer directly with CORS headers.
      continue;
    }
  }

  return { found: null, reachedServer, gotNonWpSuccess, transportFailure };
}

function classifyFailure(walk: WalkResult): DiscoverResult {
  if (walk.gotNonWpSuccess) {
    return { status: "not-wordpress", message: NOT_WORDPRESS_MESSAGE };
  }
  if (walk.reachedServer) {
    return { status: "not-found", message: NOT_FOUND_MESSAGE };
  }
  return { status: "unreachable", message: UNREACHABLE_MESSAGE };
}

/**
 * Discovers the WordPress REST API root for a site, walking up the pasted path to the
 * install root and (in direct mode) using the proxy to diagnose CORS vs unreachable.
 *
 * - Direct success → `ok` (usedProxy: false).
 * - Proxy-mode success → `ok` (usedProxy: true).
 * - Direct request blocked at the network layer but the proxy reaches a WordPress
 *   site → `cors` (reachable + WordPress, the browser just can't fetch it directly).
 * - Otherwise a precise failure: `not-found` / `not-wordpress` / `unreachable`.
 *
 * `siteUrl` on a success/`cors` result is the canonical install root that actually
 * answered — not the raw URL the user pasted.
 */
export async function discoverWpApiRoot(
  siteUrl: string,
  opts: { useProxy?: boolean } = {}
): Promise<DiscoverResult> {
  const useProxy = opts.useProxy ?? false;

  let candidates: string[];
  try {
    candidates = buildRootCandidates(normalizeSiteUrl(siteUrl));
  } catch {
    return { status: "invalid-url", message: INVALID_URL_MESSAGE };
  }

  // Proxy mode chosen up front: probe candidates server-side only.
  if (useProxy) {
    const proxy = await walkCandidates(candidates, true);
    return proxy.found
      ? { status: "ok", usedProxy: true, ...proxy.found }
      : classifyFailure(proxy);
  }

  // Direct mode: try the browser first.
  const direct = await walkCandidates(candidates, false);
  if (direct.found) {
    return { status: "ok", usedProxy: false, ...direct.found };
  }
  if (!direct.transportFailure) {
    // We reached the server(s) directly but found no WordPress — the proxy won't help.
    return classifyFailure(direct);
  }

  // Direct failed at the network layer (CORS block or host down) — diagnose via the
  // proxy, which is immune to CORS and can see the real upstream status.
  const probe = await walkCandidates(candidates, true);
  if (probe.found) {
    return { status: "cors", ...probe.found };
  }
  return classifyFailure(probe);
}
