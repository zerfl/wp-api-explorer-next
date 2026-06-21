import { describe, expect, it } from "vitest";
import {
  buildExplorerPath,
  humanizeSegment,
  normalizeSiteUrl,
  parseExplorerPath,
} from "@/lib/explorer";

describe("normalizeSiteUrl", () => {
  it("adds a protocol when missing", () => {
    expect(normalizeSiteUrl("example.com")).toBe("https://example.com");
  });

  it("preserves an explicit http protocol", () => {
    expect(normalizeSiteUrl("http://example.com")).toBe("http://example.com");
  });

  it("strips trailing slashes, query, and hash", () => {
    expect(normalizeSiteUrl("https://example.com/?foo=bar#baz")).toBe("https://example.com");
  });

  it("strips WordPress internal paths", () => {
    expect(normalizeSiteUrl("example.com/wp-json/")).toBe("https://example.com");
    expect(normalizeSiteUrl("example.com/wp-admin/options.php")).toBe("https://example.com");
  });

  it("drops a trailing file like index.php but keeps real subpaths", () => {
    expect(normalizeSiteUrl("sub.example.com/blog/index.php")).toBe("https://sub.example.com/blog");
    expect(normalizeSiteUrl("example.com/blog/")).toBe("https://example.com/blog");
  });
});

describe("parseExplorerPath", () => {
  it("parses a simple bookmark", () => {
    expect(parseExplorerPath("/site/example.com/posts/2")).toEqual({
      siteUrl: "https://example.com",
      contentType: "posts",
      page: "2",
    });
  });

  it("parses a multi-segment host path", () => {
    expect(parseExplorerPath("/site/example.com/blog/posts/1")).toEqual({
      siteUrl: "https://example.com/blog",
      contentType: "posts",
      page: "1",
    });
  });

  it("defaults an invalid page to 1", () => {
    expect(parseExplorerPath("/site/example.com/posts/not-a-number")?.page).toBe("1");
  });

  it("returns null for non-explorer or too-short paths", () => {
    expect(parseExplorerPath("/")).toBeNull();
    expect(parseExplorerPath("/site/example.com/posts")).toBeNull();
  });
});

describe("buildExplorerPath / parseExplorerPath round-trip", () => {
  it("builds a canonical path", () => {
    expect(buildExplorerPath({ siteUrl: "example.com", contentType: "posts", page: "2" })).toBe(
      "/site/example.com/posts/2"
    );
  });

  it("round-trips through parse", () => {
    const bookmark = { siteUrl: "https://example.com/blog", contentType: "media", page: "3" };
    expect(parseExplorerPath(buildExplorerPath(bookmark))).toEqual(bookmark);
  });
});

describe("humanizeSegment", () => {
  it("title-cases and replaces separators", () => {
    expect(humanizeSegment("media_items")).toBe("Media Items");
    expect(humanizeSegment("blog-posts")).toBe("Blog Posts");
    expect(humanizeSegment("posts")).toBe("Posts");
  });
});
