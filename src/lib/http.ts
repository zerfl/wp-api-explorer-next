/**
 * Shared, framework-agnostic fetch wrapper used by every network path in the app
 * (client components, the CORS proxy route handler, and schema discovery).
 *
 * Design goals:
 *  - Never throw. Always resolves to a discriminated `HttpResult` so async client
 *    handlers don't need their own try/catch around the fetch (see AGENTS.md rule 2:
 *    throwing in client fetch handlers triggers the Next.js dev crash overlay).
 *  - Always enforce a timeout via an internal AbortController, composed with the
 *    caller's signal so callers can cancel in-flight requests (race-guarding).
 *  - Optional retry/backoff for transient failures only (network/timeout/5xx/429),
 *    never for other 4xx. Honors `Retry-After` on 429.
 *  - Produce human-friendly, normalized error messages. Domain-specific error
 *    extraction (e.g. WordPress `{ code, message }` bodies) stays with the caller,
 *    which receives the raw `body` on HTTP failures.
 */

export interface HttpSuccess {
  ok: true;
  status: number;
  statusText: string;
  headers: Headers;
  /** Raw response body. Callers JSON.parse with their own guard. */
  text: string;
}

export type HttpFailureKind = "timeout" | "aborted" | "network" | "http";

export interface HttpFailure {
  ok: false;
  kind: HttpFailureKind;
  /** Present when kind === "http". */
  status: number | null;
  statusText: string;
  /** Normalized, human-readable message safe to surface in the UI. */
  message: string;
  /** Raw response body for kind === "http" (may carry a WordPress error JSON). */
  body: string | null;
  headers: Headers | null;
}

export type HttpResult = HttpSuccess | HttpFailure;

export interface HttpOptions {
  method?: string;
  headers?: HeadersInit;
  /** Caller-owned cancellation, composed with the internal timeout. */
  signal?: AbortSignal;
  /** Defaults to 15000ms. */
  timeoutMs?: number;
  /** Number of additional attempts for transient failures. Defaults to 0. */
  retries?: number;
  /** Base backoff in ms (exponential with jitter). Defaults to 400. */
  retryBaseMs?: number;
}

export const DEFAULT_TIMEOUT_MS = 15000;

const ABORTED: HttpFailure = {
  ok: false,
  kind: "aborted",
  status: null,
  statusText: "",
  message: "Request cancelled.",
  body: null,
  headers: null,
};

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function networkFailure(): HttpFailure {
  return {
    ok: false,
    kind: "network",
    status: null,
    statusText: "",
    message: "Network error — the request could not be completed. The site may be unreachable.",
    body: null,
    headers: null,
  };
}

function timeoutFailure(timeoutMs: number): HttpFailure {
  return {
    ok: false,
    kind: "timeout",
    status: null,
    statusText: "",
    message: `Request timed out after ${Math.round(timeoutMs / 1000)}s. The site may be slow or unreachable.`,
    body: null,
    headers: null,
  };
}

function httpStatusMessage(status: number, statusText: string): string {
  const label = statusText ? `${status} ${statusText}` : `${status}`;
  switch (status) {
    case 400:
      return `Bad request (${label}). One of the query parameters may be invalid.`;
    case 401:
      return `Authentication required (${label}). Add an application password in settings.`;
    case 403:
      return `Access forbidden (${label}). The endpoint may require authentication or higher permissions.`;
    case 404:
      return `Not found (${label}). The endpoint may not exist on this site.`;
    case 429:
      return `Rate limited (${label}). The server is throttling requests — try again shortly.`;
    default:
      if (status >= 500) {
        return `Server error (${label}). The site returned an error.`;
      }
      return `Request failed (${label}).`;
  }
}

/** Compose the caller's signal with the internal timeout signal. */
function composeSignals(caller: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  if (!caller) {
    return timeout;
  }
  const anyFn = (AbortSignal as unknown as {
    any?: (signals: AbortSignal[]) => AbortSignal;
  }).any;
  if (typeof anyFn === "function") {
    return anyFn([caller, timeout]);
  }
  // Fallback for environments without AbortSignal.any.
  const controller = new AbortController();
  const abort = (signal: AbortSignal) => controller.abort(signal.reason);
  if (caller.aborted) {
    controller.abort(caller.reason);
  } else {
    caller.addEventListener("abort", () => abort(caller), { once: true });
  }
  if (timeout.aborted) {
    controller.abort(timeout.reason);
  } else {
    timeout.addEventListener("abort", () => abort(timeout), { once: true });
  }
  return controller.signal;
}

function backoffDelay(baseMs: number, attempt: number): number {
  const exponential = baseMs * 2 ** attempt;
  const jitter = Math.random() * baseMs;
  return Math.min(exponential + jitter, DEFAULT_TIMEOUT_MS);
}

function parseRetryAfter(headers: Headers): number | null {
  const raw = headers.get("retry-after");
  if (!raw) {
    return null;
  }
  const seconds = Number.parseInt(raw, 10);
  if (Number.isFinite(seconds) && String(seconds) === raw.trim()) {
    return Math.max(seconds * 1000, 0);
  }
  const dateMs = Date.parse(raw);
  if (Number.isFinite(dateMs)) {
    return Math.max(dateMs - Date.now(), 0);
  }
  return null;
}

/** Sleep that rejects if the caller aborts during the wait. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const id = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function httpRequest(url: string, opts: HttpOptions = {}): Promise<HttpResult> {
  const {
    method = "GET",
    headers,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
    retryBaseMs = 400,
  } = opts;

  let lastFailure: HttpFailure = networkFailure();

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (signal?.aborted) {
      return ABORTED;
    }

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort(new DOMException("Timeout", "TimeoutError"));
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        signal: composeSignals(signal, timeoutController.signal),
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      if (isRetryableStatus(response.status) && attempt < retries) {
        const wait = parseRetryAfter(response.headers) ?? backoffDelay(retryBaseMs, attempt);
        try {
          await delay(wait, signal);
        } catch {
          return ABORTED;
        }
        continue;
      }

      const text = await response.text();
      if (!response.ok) {
        return {
          ok: false,
          kind: "http",
          status: response.status,
          statusText: response.statusText,
          message: httpStatusMessage(response.status, response.statusText),
          body: text,
          headers: response.headers,
        };
      }

      return {
        ok: true,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        text,
      };
    } catch {
      clearTimeout(timeoutId);

      // Caller-initiated cancellation is terminal and never retried.
      if (signal?.aborted) {
        return ABORTED;
      }

      lastFailure = timeoutController.signal.aborted ? timeoutFailure(timeoutMs) : networkFailure();

      if (attempt < retries) {
        try {
          await delay(backoffDelay(retryBaseMs, attempt), signal);
        } catch {
          return ABORTED;
        }
        continue;
      }
    }
  }

  return lastFailure;
}
