import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "@/lib/site-url";

describe("resolveSiteUrl", () => {
  it("puts root-relative paths on the site's host", () => {
    expect(resolveSiteUrl("/wp-content/uploads/a.jpg", "https://a.test")).toBe(
      "https://a.test/wp-content/uploads/a.jpg"
    );
  });

  it("keeps a subdirectory install's path for path-relative URLs", () => {
    expect(resolveSiteUrl("wp-content/uploads/a.jpg", "https://a.test/blog")).toBe(
      "https://a.test/blog/wp-content/uploads/a.jpg"
    );
  });

  it("leaves absolute URLs on other hosts alone", () => {
    expect(resolveSiteUrl("https://cdn.test/a.jpg", "https://a.test")).toBe("https://cdn.test/a.jpg");
  });

  it("gives protocol-relative URLs the site's scheme", () => {
    expect(resolveSiteUrl("//cdn.test/a.jpg", "http://a.test")).toBe("http://cdn.test/a.jpg");
  });

  it("keeps empty values empty", () => {
    expect(resolveSiteUrl("", "https://a.test")).toBe("");
  });
});
