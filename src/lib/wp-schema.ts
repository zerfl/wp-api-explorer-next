import { httpRequest } from "@/lib/http";

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
 * Discovers the API root URL from a given WordPress site url.
 * It first checks for the link header or tags, or defaults to appending /wp-json/.
 */
export async function discoverWpApiRoot(siteUrl: string, useProxy: boolean = false): Promise<{ apiRoot: string; schema: WpSchema }> {
  let cleanedUrl = siteUrl.trim();
  if (!/^https?:\/\//i.test(cleanedUrl)) {
    cleanedUrl = "https://" + cleanedUrl;
  }
  
  // Remove trailing slashes
  cleanedUrl = cleanedUrl.replace(/\/+$/, "");

  // Strategy 1: Try checking /wp-json/ index directly
  const tryApiRoots = [
    `${cleanedUrl}/wp-json`,
    `${cleanedUrl}/index.php?rest_route=/`
  ];

  let lastErrorMessage: string | null = null;

  for (const root of tryApiRoots) {
    const fetchUrl = useProxy
      ? `/api/proxy?url=${encodeURIComponent(root)}`
      : root;

    // Connecting is the critical step, so allow a longer timeout and one retry
    // for transient failures. httpRequest never throws — it returns a result.
    const result = await httpRequest(fetchUrl, { timeoutMs: 20000, retries: 1 });
    if (!result.ok) {
      lastErrorMessage = result.message;
      continue;
    }

    let json: unknown = null;
    try {
      json = JSON.parse(result.text);
    } catch {
      lastErrorMessage = "The site responded but did not return valid JSON.";
      continue;
    }

    // Basic check to see if this is a WordPress schema response
    if (json && typeof json === "object" && "routes" in json) {
      const schema = json as Record<string, unknown>;
      return {
        apiRoot: root,
        schema: {
          name: (schema.name as string) || "WordPress Site",
          description: (schema.description as string) || "",
          url: (schema.url as string) || cleanedUrl,
          namespaces: (schema.namespaces as string[]) || [],
          routes: schema.routes as WpSchema["routes"],
        },
      };
    }

    lastErrorMessage = "The site responded but does not expose a WordPress REST API index.";
  }

  throw new Error(
    lastErrorMessage ||
      "Could not find a valid WordPress REST API index. Check the site URL, and try Proxy mode if the site blocks cross-origin requests."
  );
}
