import { isMediaRoute } from "@/lib/explorer-client";

function stringAt(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value ? value : null;
}

function itemUrl(item: unknown, media: boolean): string | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const record = item as Record<string, unknown>;

  if (media) {
    const guid = record.guid;
    const guidUrl =
      guid && typeof guid === "object" ? stringAt(guid as Record<string, unknown>, "rendered") : null;
    return stringAt(record, "source_url") ?? guidUrl;
  }

  return stringAt(record, "link");
}

/** One URL per item, in display order: `source_url` for media, `link` otherwise. */
export function buildUrlList(items: unknown[], routePath: string): string[] {
  const media = isMediaRoute(routePath);
  const urls = new Set<string>();
  for (const item of items) {
    const url = itemUrl(item, media);
    if (url) {
      urls.add(url);
    }
  }
  return [...urls];
}

export function urlListFilename(
  siteUrl: string,
  typeSlug: string,
  firstPage: number,
  lastPage: number
): string {
  let host = siteUrl;
  try {
    host = new URL(siteUrl).host;
  } catch {
    // Keep the raw value; the sanitizer below makes it filename-safe.
  }

  const pages = firstPage === lastPage ? `p${firstPage}` : `p${firstPage}-${lastPage}`;
  return `${host}-${typeSlug}-${pages}.txt`.replace(/[^\w.-]+/g, "_");
}

export function downloadTextFile(filename: string, lines: string[]) {
  const blob = new Blob([lines.length ? `${lines.join("\n")}\n` : ""], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
