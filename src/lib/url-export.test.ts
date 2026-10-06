import { describe, expect, it } from "vitest";
import { buildUrlList, urlListFilename } from "@/lib/url-export";

describe("buildUrlList", () => {
  it("uses source_url for media, falling back to guid.rendered", () => {
    const items = [
      { id: 1, source_url: "https://a.test/1.jpg" },
      { id: 2, guid: { rendered: "https://a.test/?attachment_id=2" } },
      { id: 3 },
    ];
    expect(buildUrlList(items, "/wp/v2/media")).toEqual([
      "https://a.test/1.jpg",
      "https://a.test/?attachment_id=2",
    ]);
  });

  it("uses link for other collections and ignores source_url there", () => {
    const items = [
      { id: 1, link: "https://a.test/hello/", source_url: "https://a.test/x.jpg" },
      { id: 2, link: "" },
      "not-an-object",
    ];
    expect(buildUrlList(items, "/wp/v2/posts")).toEqual(["https://a.test/hello/"]);
  });

  it("keeps first-seen order and drops repeats", () => {
    const items = [
      { link: "https://a.test/b/" },
      { link: "https://a.test/a/" },
      { link: "https://a.test/b/" },
    ];
    expect(buildUrlList(items, "/wp/v2/pages")).toEqual(["https://a.test/b/", "https://a.test/a/"]);
  });
});

describe("urlListFilename", () => {
  it("names a range by host, type and pages", () => {
    expect(urlListFilename("https://example.com/blog", "media", 6, 200)).toBe("example.com-media-p6-200.txt");
  });

  it("names a single page without a range", () => {
    expect(urlListFilename("https://example.com:8080", "posts", 3, 3)).toBe("example.com_8080-posts-p3.txt");
  });
});
