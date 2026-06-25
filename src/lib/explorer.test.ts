import { describe, expect, it } from "vitest";
import {
  buildExplorerUrl,
  buildRootCandidates,
  humanizeSegment,
  MAX_ROOT_CANDIDATES,
  normalizeSiteUrl,
  parseExplorerQuery,
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

  it("keeps a pasted post permalink as a subpath (root walk-up happens later)", () => {
    expect(normalizeSiteUrl("https://www.francescorizzato.com/business-portrait-muenchen/")).toBe(
      "https://www.francescorizzato.com/business-portrait-muenchen"
    );
  });
});

describe("buildRootCandidates", () => {
  it("returns just the host for a root URL", () => {
    expect(buildRootCandidates("https://example.com")).toEqual(["https://example.com"]);
  });

  it("walks a pasted subpage up to the host root, deepest first", () => {
    expect(
      buildRootCandidates("https://www.francescorizzato.com/business-portrait-muenchen")
    ).toEqual([
      "https://www.francescorizzato.com/business-portrait-muenchen",
      "https://www.francescorizzato.com",
    ]);
  });

  it("includes a subdirectory install before the bare host", () => {
    expect(buildRootCandidates("https://example.com/site")).toEqual([
      "https://example.com/site",
      "https://example.com",
    ]);
  });

  it("ignores a trailing slash", () => {
    expect(buildRootCandidates("https://example.com/a/b/")).toEqual([
      "https://example.com/a/b",
      "https://example.com/a",
      "https://example.com",
    ]);
  });

  it("preserves the port and http protocol", () => {
    expect(buildRootCandidates("http://localhost:8080/blog")).toEqual([
      "http://localhost:8080/blog",
      "http://localhost:8080",
    ]);
  });

  it("caps the number of candidates for pathologically deep URLs", () => {
    const candidates = buildRootCandidates("https://example.com/a/b/c/d/e/f/g");
    expect(candidates).toHaveLength(MAX_ROOT_CANDIDATES);
    expect(candidates[0]).toBe("https://example.com/a/b/c/d/e/f/g");
    expect(candidates.at(-1)).toBe("https://example.com/a/b/c");
  });
});

describe("buildExplorerUrl / parseExplorerQuery", () => {
  it("encodes a bookmark as a query string on the root", () => {
    expect(buildExplorerUrl({ siteUrl: "example.com", contentType: "posts", page: "2" })).toBe(
      "/?site=https%3A%2F%2Fexample.com&type=posts&page=2"
    );
  });

  it("parses a query string back into a bookmark", () => {
    expect(parseExplorerQuery("?site=https%3A%2F%2Fexample.com&type=posts&page=2")).toEqual({
      siteUrl: "https://example.com",
      contentType: "posts",
      page: "2",
    });
  });

  it("round-trips through build → parse", () => {
    const bookmark = { siteUrl: "https://example.com/blog", contentType: "media", page: "3" };
    expect(parseExplorerQuery(buildExplorerUrl(bookmark))).toEqual(bookmark);
  });

  it("round-trips a subdirectory install whose path is literally /site (the old conflict)", () => {
    const bookmark = { siteUrl: "https://example.com/site", contentType: "pages", page: "1" };
    expect(parseExplorerQuery(buildExplorerUrl(bookmark))).toEqual(bookmark);
  });

  it("defaults an invalid or zero page to 1", () => {
    expect(parseExplorerQuery("?site=https://example.com&type=posts&page=not-a-number")?.page).toBe(
      "1"
    );
    expect(parseExplorerQuery("?site=https://example.com&type=posts&page=0")?.page).toBe("1");
    expect(parseExplorerQuery("?site=https://example.com&type=posts")?.page).toBe("1");
  });

  it("returns null when site or type is missing", () => {
    expect(parseExplorerQuery("")).toBeNull();
    expect(parseExplorerQuery("?type=posts&page=1")).toBeNull();
    expect(parseExplorerQuery("?site=https://example.com&page=1")).toBeNull();
  });
});

describe("humanizeSegment", () => {
  it("title-cases and replaces separators", () => {
    expect(humanizeSegment("media_items")).toBe("Media Items");
    expect(humanizeSegment("blog-posts")).toBe("Blog Posts");
    expect(humanizeSegment("posts")).toBe("Posts");
  });
});
