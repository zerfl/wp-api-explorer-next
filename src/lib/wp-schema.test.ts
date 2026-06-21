import { describe, expect, it } from "vitest";
import { CORE_FALLBACK_ROUTES, parseWpSchema, type WpSchema } from "@/lib/wp-schema";

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
