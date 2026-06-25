import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CORE_FALLBACK_ROUTES,
  discoverWpApiRoot,
  parseWpSchema,
  type WpSchema,
} from "@/lib/wp-schema";

const schema: WpSchema = {
  name: "Test",
  description: "",
  url: "https://example.com",
  namespaces: ["wp/v2", "custom/v1"],
  routes: {
    "/": { endpoints: [{ methods: ["GET"] }] },
    "/wp/v2/posts": { endpoints: [{ methods: ["GET", "POST"] }] },
    "/wp/v2/posts/(?P<id>[\\d]+)": { endpoints: [{ methods: ["GET"] }] },
    "/wp/v2/settings": { endpoints: [{ methods: ["POST"] }] },
    "/custom/v1/widgets": { endpoints: [{ methods: ["GET"] }] },
  },
};

describe("parseWpSchema", () => {
  it("keeps GET collection routes and drops single-item / non-GET routes", () => {
    const paths = parseWpSchema(schema).map((route) => route.path);
    expect(paths).toContain("/wp/v2/posts");
    expect(paths).toContain("/custom/v1/widgets");
    expect(paths).toContain("/");
    expect(paths).not.toContain("/wp/v2/posts/(?P<id>[\\d]+)");
    expect(paths).not.toContain("/wp/v2/settings");
  });

  it("assigns namespaces (including the index)", () => {
    const routes = parseWpSchema(schema);
    expect(routes.find((route) => route.path === "/wp/v2/posts")?.namespace).toBe("wp/v2");
    expect(routes.find((route) => route.path === "/custom/v1/widgets")?.namespace).toBe("custom/v1");
    expect(routes.find((route) => route.path === "/")?.namespace).toBe("index");
  });

  it("falls back to core routes when the schema has no parseable routes", () => {
    const fallback = parseWpSchema({ ...schema, routes: {} });
    expect(fallback).toHaveLength(Object.keys(CORE_FALLBACK_ROUTES).length);
    expect(fallback.map((route) => route.path)).toContain("/wp/v2/posts");
  });
});

// ---- discovery ------------------------------------------------------------

type Probe = { target: string; viaProxy: boolean };

/** A WordPress REST index response. */
const wpIndex = (siteUrl: string) =>
  new Response(
    JSON.stringify({
      name: "Test WP",
      url: siteUrl,
      namespaces: ["wp/v2"],
      routes: { "/": {}, "/wp/v2/posts": {} },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );

/** A WordPress "no route" 404 (a real upstream response). */
const notFound = () =>
  new Response(JSON.stringify({ code: "rest_no_route", message: "No route was found." }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });

/** What our proxy returns when it cannot reach the upstream host. */
const proxyUnreachable = () =>
  new Response(JSON.stringify({ error: "Failed to fetch target URL", details: "ENOTFOUND" }), {
    status: 502,
    headers: { "content-type": "application/json" },
  });

/** A 200 that isn't a WordPress index (e.g. a plain HTML site). */
const nonWordPress = () =>
  new Response("<!doctype html><title>Not WordPress</title>", {
    status: 200,
    headers: { "content-type": "text/html" },
  });

/** Stub global fetch, routing /api/proxy?url=… calls to the handler as proxy probes. */
function stubFetch(handler: (probe: Probe) => Response | Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.startsWith("/api/proxy")) {
        const target = new URLSearchParams(url.split("?")[1]).get("url") ?? "";
        return handler({ target, viaProxy: true });
      }
      return handler({ target: url, viaProxy: false });
    })
  );
}

describe("discoverWpApiRoot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("connects directly when the entered root is correct and CORS-friendly", async () => {
    stubFetch(({ target }) =>
      target === "https://example.com/wp-json" ? wpIndex(target) : notFound()
    );

    const result = await discoverWpApiRoot("https://example.com", { useProxy: false });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.usedProxy).toBe(false);
      expect(result.siteUrl).toBe("https://example.com");
      expect(result.apiRoot).toBe("https://example.com/wp-json");
    }
  });

  it("walks up a pasted subpage to the install root (CORS-friendly site)", async () => {
    stubFetch(({ target }) =>
      target === "https://example.com/wp-json" ? wpIndex(target) : notFound()
    );

    const result = await discoverWpApiRoot("https://example.com/business-portrait-muenchen", {
      useProxy: false,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      // Canonicalized to the real root, not the pasted subpage.
      expect(result.siteUrl).toBe("https://example.com");
      expect(result.apiRoot).toBe("https://example.com/wp-json");
    }
  });

  it("connects directly from a deep permalink when only the non-REST subpath is CORS-blocked", async () => {
    // The real browser case the early-bail used to mishandle: probing the pasted
    // subpath's `/wp-json` is a non-REST URL, so it carries no CORS header and the
    // browser blocks it into a network failure — but the shallower real `/wp-json`
    // answers directly with CORS headers. The walk must climb past the block.
    stubFetch(({ target, viaProxy }) => {
      if (!viaProxy && target.startsWith("https://example.com/business-portrait-muenchen")) {
        throw new TypeError("Failed to fetch"); // CORS block on the non-REST subpath
      }
      return target === "https://example.com/wp-json" ? wpIndex(target) : notFound();
    });

    const result = await discoverWpApiRoot("https://example.com/business-portrait-muenchen", {
      useProxy: false,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.usedProxy).toBe(false); // no proxy needed — direct connect
      expect(result.siteUrl).toBe("https://example.com");
      expect(result.apiRoot).toBe("https://example.com/wp-json");
    }
  });

  it("detects CORS: direct blocked at the network layer but the proxy reaches WordPress", async () => {
    stubFetch(({ target, viaProxy }) => {
      if (!viaProxy) {
        throw new TypeError("Failed to fetch"); // browser CORS block
      }
      return target === "https://example.com/wp-json" ? wpIndex(target) : notFound();
    });

    const result = await discoverWpApiRoot("https://example.com/some-post", { useProxy: false });

    expect(result.status).toBe("cors");
    if (result.status === "cors") {
      expect(result.siteUrl).toBe("https://example.com");
      expect(result.apiRoot).toBe("https://example.com/wp-json");
    }
  });

  it("reports unreachable when neither the browser nor the proxy can reach the host", async () => {
    stubFetch(({ viaProxy }) => {
      if (!viaProxy) {
        throw new TypeError("Failed to fetch");
      }
      return proxyUnreachable();
    });

    const result = await discoverWpApiRoot("https://down.example", { useProxy: false });

    expect(result.status).toBe("unreachable");
  });

  it("reports not-found when the host answers but exposes no WordPress REST index", async () => {
    stubFetch(() => notFound());

    const result = await discoverWpApiRoot("https://example.com", { useProxy: false });

    expect(result.status).toBe("not-found");
  });

  it("reports not-wordpress when a candidate returns 200 that isn't a WP index", async () => {
    stubFetch(() => nonWordPress());

    const result = await discoverWpApiRoot("https://example.com", { useProxy: false });

    expect(result.status).toBe("not-wordpress");
  });

  it("connects through the proxy when proxy mode is chosen up front", async () => {
    stubFetch(({ target, viaProxy }) => {
      expect(viaProxy).toBe(true); // direct transport is never used in proxy mode
      return target === "https://example.com/wp-json" ? wpIndex(target) : notFound();
    });

    const result = await discoverWpApiRoot("https://example.com", { useProxy: true });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.usedProxy).toBe(true);
      expect(result.apiRoot).toBe("https://example.com/wp-json");
    }
  });
});
