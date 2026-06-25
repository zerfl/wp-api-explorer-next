# WordPress REST API & Proxy Explainer

This document outlines how this application interacts with WordPress REST API endpoints, parses schemas, handles CORS issues, and processes data.

## 1. Schema Discovery (`/wp-json/`)
Rather than hardcoding routes and parameters, the application interacts with the WordPress REST API dynamically:
- **Discovery Entrypoint:** When a user inputs a site URL (e.g. `https://techcrunch.com`), the application first tests `GET /wp-json/`.
- **Root walk-up:** Users frequently paste a deep page URL (e.g. `https://example.com/some-post/`) or a subdirectory install (`https://example.com/site/`). `discoverWpApiRoot` (`src/lib/wp-schema.ts`) builds an ordered list of candidate roots via `buildRootCandidates` — **deepest path first, the bare host last** — and probes each (`/wp-json` then `/index.php?rest_route=/`). Deepest-first means a genuine subdirectory install is matched before the host, while a pasted permalink falls through to the host root once the deeper probes 404. The first candidate that returns a valid REST index wins, and its base becomes the **canonical** site URL used for the connection and the bookmark — not the raw URL the user pasted.
- **Precise outcomes:** Discovery returns a discriminated `DiscoverResult` (`ok` / `cors` / `not-found` / `not-wordpress` / `unreachable` / `invalid-url`) so the UI shows the real cause instead of a generic "network error". See §2 for how CORS is distinguished from an unreachable host.
- **Route Schema Extraction:** The response from `/wp-json/` contains a `routes` dictionary mapping path templates to their endpoint metadata:
  ```json
  {
    "routes": {
      "/wp/v2/posts": {
        "endpoints": [
          {
            "methods": ["GET"],
            "args": {
              "page": { "type": "integer", "description": "Current page of the collection." },
              "per_page": { "type": "integer", "description": "Maximum number of items..." }
            }
          }
        ]
      }
    }
  }
  ```
- **Fallback Behavior:** If a site blocks the directory index `/wp-json/` (common in security plugins), we fallback to a list of core endpoints (`/wp/v2/posts`, `/wp/v2/pages`, `/wp/v2/media`, `/wp/v2/comments`, `/wp/v2/users`, `/wp/v2/categories`, `/wp/v2/tags`) so the user can still perform standard queries.

## 2. Dynamic CORS Bypassing Proxy
Browsers restrict cross-origin requests unless the target server returns proper CORS headers. Since many sites lock down CORS:
- **Local Route:** We implement a Next.js API Route `/api/proxy` (App Router: `src/app/api/proxy/route.ts`).
- **Query Parameter:** The proxy takes a URL: `/api/proxy?url=encodeURIComponent(https://techcrunch.com/wp-json/wp/v2/posts)`.
- **Headers Propagation:** The proxy forwards headers like `Authorization` (if specified), fetches the target, and mirrors the status and body back to the browser.
- **Pagination Headers:** The proxy **MUST** read and append the WordPress total-count headers (`x-wp-total`, `x-wp-totalpages`) to its own HTTP response headers, as these are critical for client-side pagination.

### CORS diagnosis (direct → proxy probe)
A cross-origin browser `fetch` to a site without CORS headers rejects with an opaque `TypeError` — the browser **cannot** tell a CORS block from a dead host, and most WordPress sites send no CORS headers. We resolve this server-side:
- In **direct** mode, if a candidate fails at the network layer, discovery re-probes the same candidates **through the proxy** (which is immune to CORS and sees the real upstream status).
- Proxy reaches a WordPress site → the failure was **CORS** (`status: "cors"`): the site is reachable and is WordPress, the browser just can't fetch it directly.
- Proxy gets real 404s with no REST index → **`not-found`**; proxy can't reach the host at all (its own `502`) → **`unreachable`**.

### Auto-proxy on CORS (opt-in)
A persisted user preference (`wp-api-explorer.auto-proxy`, **default off**) controls what happens on a `cors` result:
- **Off:** show a precise CORS message plus a one-click **"Retry with proxy"** action; the user stays in control of the transport.
- **On:** connect through the proxy transparently and show a dismissible notice that the explorer switched to proxy mode.

## 3. Embedded Entities (`_embed`)
WordPress returns IDs for relational fields like authors (`author`), featured images (`featured_media`), and categories/tags (`categories`, `tags`).
- Adding the parameter `_embed=true` or `_embed=1` instructs WordPress to bundle the full representations of these items inside the response under the key `_embedded`.
- **Author:** Found at `item._embedded?.author?.[0]`. Contains `name`, `avatar_urls`, `link`.
- **Featured Media:** Found at `item._embedded?.['wp:featuredmedia']?.[0]`. Contains `source_url`, `media_details.sizes`, `alt_text`.
- **Terms (Categories/Tags):** Found at `item._embedded?.['wp:term']`. Returns a nested array of terms representing taxonomy objects.

## 4. Query Params & Filters
- **Posts/Pages:** Can filter by `author` ID, `categories` (comma-separated ID string), `tags` (comma-separated ID string), `status` (publish, draft, etc.), `sticky` (boolean), `orderby`, `order`, and `search`.
- **Media:** Can filter by `parent` ID, `media_type` (e.g. `image`), and `mime_type` (e.g. `image/jpeg`).
- **Comments:** Can filter by `post` ID, `author_email`, `status`.
- **Users:** Can filter by `roles`.
