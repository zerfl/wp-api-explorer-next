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
