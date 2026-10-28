/**
 * Resolve a URL from a WordPress response against the connected site. Some sites
 * (e.g. relative-URL plugins) return `/wp-content/...` paths, which the browser
 * would otherwise resolve against the explorer's own origin.
 */
export function resolveSiteUrl(url: string, siteUrl: string): string {
  if (!url) {
    return url;
  }
  try {
    return new URL(url, siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`).href;
  } catch {
    return url;
  }
}
