export type PageInputResult = { ok: true; page: number } | { ok: false; message: string };

/** Validates the jump-to-page input. `totalPages` null means the upper bound is unknown. */
export function parsePageInput(raw: string, totalPages: number | null): PageInputResult {
  const value = raw.trim();
  if (!/^\d+$/.test(value)) {
    return { ok: false, message: "Enter a whole page number" };
  }

  const page = Number.parseInt(value, 10);
  if (page < 1 || (totalPages !== null && page > totalPages)) {
    return {
      ok: false,
      message: totalPages !== null ? `Pages run from 1 to ${totalPages}` : "Pages start at 1",
    };
  }

  return { ok: true, page };
}

/**
 * Page buttons to show: first, last, `pinned`, and `delta` pages around the
 * focus page, with "..." for gaps (a gap of one page shows the page instead).
 */
export function getPageNumbers(
  focusPage: number,
  totalPages: number,
  delta = 2,
  pinned: number[] = []
): Array<number | "..."> {
  const result: Array<number | "..."> = [];
  let previous: number | undefined;

  for (let page = 1; page <= totalPages; page++) {
    const visible =
      page === 1 ||
      page === totalPages ||
      pinned.includes(page) ||
      (page >= focusPage - delta && page <= focusPage + delta);
    if (!visible) {
      continue;
    }

    if (previous !== undefined) {
      if (page - previous === 2) {
        result.push(previous + 1);
      } else if (page - previous > 2) {
        result.push("...");
      }
    }
    result.push(page);
    previous = page;
  }

  return result;
}
