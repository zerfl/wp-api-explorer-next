import { afterEach, describe, expect, it, vi } from "vitest";
import { httpRequest } from "@/lib/http";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A fetch that never resolves on its own — it only rejects when its signal aborts. */
function hangingFetch() {
  return vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      })
  );
}

describe("httpRequest", () => {
  it("returns ok with body and headers on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]", { status: 200, headers: { "x-wp-total": "5" } }))
    );

    const result = await httpRequest("https://example.com");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe("[]");
      expect(result.status).toBe(200);
      expect(result.headers.get("x-wp-total")).toBe("5");
    }
  });

  it("returns an http failure (with body) for non-2xx and does not retry 404", async () => {
    const fetchMock = vi.fn(async () => new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await httpRequest("https://example.com", { retries: 3 });

    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (!result.ok) {
      expect(result.kind).toBe("http");
      expect(result.status).toBe(404);
      expect(result.body).toBe("not found");
      expect(result.message).toMatch(/not found/i);
    }
  });

  it("retries on 429 honoring Retry-After, then succeeds", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return new Response("slow down", { status: 429, headers: { "retry-after": "0" } });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      })
    );

    const result = await httpRequest("https://example.com", { retries: 2, retryBaseMs: 1 });

    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
  });

  it("retries a transient network error then succeeds", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          throw new TypeError("Failed to fetch");
        }
        return new Response("{}", { status: 200 });
      })
    );

    const result = await httpRequest("https://example.com", { retries: 1, retryBaseMs: 1 });

    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
  });

  it("normalizes a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );

    const result = await httpRequest("https://example.com");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("network");
      expect(result.message).toMatch(/network/i);
    }
  });

  it("times out a hung request", async () => {
    vi.stubGlobal("fetch", hangingFetch());

    const result = await httpRequest("https://example.com", { timeoutMs: 30 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("timeout");
      expect(result.message).toMatch(/timed out/i);
    }
  });

  it("reports caller-initiated cancellation as aborted (not an error)", async () => {
    vi.stubGlobal("fetch", hangingFetch());

    const controller = new AbortController();
    const pending = httpRequest("https://example.com", {
      signal: controller.signal,
      timeoutMs: 5000,
    });
    controller.abort();

    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("aborted");
    }
  });
});
