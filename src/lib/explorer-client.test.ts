import { describe, expect, it } from "vitest";
import {
  buildBaseQueryParams,
  extractWpErrorMessage,
  isMediaRoute,
} from "@/lib/explorer-client";
import type { WpRouteInfo } from "@/lib/wp-schema";

const postsRoute: WpRouteInfo = {
  path: "/wp/v2/posts",
  namespace: "wp/v2",
  endpoints: [
    {
      methods: ["GET"],
      args: {
        page: { type: "integer", default: 1 },
        per_page: { type: "integer", default: 10 },
        orderby: { type: "string", default: "date" },
        search: { type: "string" },
        _embed: { type: "boolean" },
      },
    },
  ],
};

describe("buildBaseQueryParams", () => {
  it("applies schema defaults, _embed, and override precedence", () => {
    expect(buildBaseQueryParams(postsRoute, "100", { page: "2" })).toEqual({
      page: "2",
      per_page: "100",
      orderby: "date",
      _embed: "true",
    });
  });

  it("lets an explicit per_page override the preference", () => {
    expect(buildBaseQueryParams(postsRoute, "100", { per_page: "25" }).per_page).toBe("25");
  });
});

describe("isMediaRoute", () => {
  it("detects the media collection", () => {
    expect(isMediaRoute("/wp/v2/media")).toBe(true);
    expect(isMediaRoute("/wp/v2/posts")).toBe(false);
  });
});

describe("extractWpErrorMessage", () => {
  it("reads a WordPress error message", () => {
    expect(extractWpErrorMessage('{"code":"rest_invalid","message":"Bad page"}')).toBe("Bad page");
  });

  it("falls back to a proxy error field", () => {
    expect(extractWpErrorMessage('{"error":"Failed to fetch"}')).toBe("Failed to fetch");
  });

  it("returns null for non-error JSON, blank messages, or non-JSON", () => {
    expect(extractWpErrorMessage('{"data":1}')).toBeNull();
    expect(extractWpErrorMessage('{"message":"   "}')).toBeNull();
    expect(extractWpErrorMessage("<html>nope</html>")).toBeNull();
    expect(extractWpErrorMessage(null)).toBeNull();
  });
});
