# Application Architecture

This document describes the design layout, component responsibilities, and application state flows.

## Component Hierarchy

```
Layout (Sidebar + Main Panel)
 ├── Sidebar
 │    ├── SiteSelector       # Inputs WordPress site URL & performs schema discovery
 │    └── RouteNavigator     # Lists namespaces and routes dynamically parsed from schema
 └── Main Content Area
      ├── RequestHeader      # Displays HTTP method, target URL, and copyable cURL commands
      ├── FilterPanel        # Dynamic inputs based on the arguments of the active route
      ├── ResponseMetrics    # Shows response status code, execution time, and total counts
      └── ResultTabs         # Tabs for exploring the return payload
           ├── VisualReader  # Rich previews tailored to response schemas
           ├── DataTable     # Tabular column-based layout
           └── JsonViewer    # Collapsible interactive JSON explorer
```

## Component Details & Responsibilities

### Connection controls (`ExplorerHeader` / `ExplorerProvider`)
- Maintains the `siteUrl` input and verifies it points to a WordPress site.
- Discovers the API root via `discoverWpApiRoot`, which **walks up** a pasted subpage/subdirectory URL to the install root and canonicalizes the connection to the root that actually answered (see `docs/API_EXPLAINER.md` §1).
- Populates `routes` state from the `/wp-json/` index or falls back to core endpoints.
- Surfaces precise connection outcomes, including a **CORS** result with a "Retry with proxy" action and an opt-in **auto-proxy** toggle (`ExplorerHeader` settings popover).

## Bookmarks & URL state

Explorer state (selected site, content type, page) is encoded as a **query string on the app root**:

```
/?site=<normalized-site-url>&type=<content-type>&page=<n>
```

- `buildExplorerUrl` / `parseExplorerQuery` (`src/lib/explorer.ts`) are the single encode/decode pair. The whole site URL — including any subdirectory install path — lives in the single `site` value, so it never collides with the target site's own paths (a WordPress install at `example.com/site/` round-trips cleanly). This replaced the earlier `/site/[…segments]` route, which reserved a path prefix that conflicted with subdirectory installs.
- `ExplorerProvider` tracks `location.search` directly (initialized on mount, updated on `popstate`) and derives the bookmark with `useMemo`. It intentionally does **not** use `useSearchParams()`, which would force a whole-page CSR bailout.
- Navigations call `history.pushState`/`replaceState` and keep `search` state in sync; on load, a present bookmark auto-connects to its site.
- Appending pages ("+10 pages" / "Load all remaining") does **not** change the URL: `page` stays the first page shown. A bookmark, reload or Back therefore costs one request; encoding the range would replay up to hundreds of requests on every open. The downloadable URL list is the durable record of a bulk load.

## Accumulate mode (page ranges)

The header and the bottom of the results both render `Pagination`: a stepper (previous, a "5–15 / 17" field you click to type a page number, next) and a split button whose main action is "+10 pages" (or "Load remaining N" when 10 or fewer are left), with "Load all remaining", "Download URLs" and "Back to page X only" in its menu. While a run is going, the split button becomes Stop with a progress fill. `BulkLoadStatus` shows progress once, between the filters and the results. `usePageRangeLoad` (`src/lib/use-page-range-load.ts`) holds the session in refs and exposes `bulkLoad` state; `executeApiRequest` starts a new session for every single-page request, and `clearRequestState` ends it.

- A run takes a request-guard ticket, so any navigation supersedes it. Stop uses `abortCurrent()` (ticket stays current, partial result kept). `clearRequestState` calls `invalidate()`, which also cancels requests that `selectRoute`/`setAdvancedMode` would otherwise let finish into the new view.
- Bulk runs reuse the params of the request that produced the page shown, not the live (possibly edited, unsearched) filter inputs.
- Appending must not block the main thread. Appended items reach React state at most every 750 ms, inside `startTransition` so React renders new cards in time slices. Result views are memoized and render memoized per-item cards (`VisualReader`, `DataTable` rows), so a flush renders only the new items and progress updates skip the list. Cards use `content-visibility: auto`, so off-screen cards cost almost no layout or paint. Measured on a production build, loading 17 pages (1,633 media items) had no long tasks and a worst frame gap of 35 ms. Keep these when touching the result views.
- Results stay visible during a run: bulk loading has its own state and never sets `isLoading`.
- Any page click, jump, filter or per-page change, collection switch, or "Show page X only" returns to normal paging.

## Date-window listing mode

For routes whose schema accepts both `after` and `before`, the explorer offers a "date windows" listing mode that walks the date axis in adaptive windows instead of paging the full collection (see `docs/API_EXPLAINER.md` §5 for why some large sites time out on unbounded requests). `executeApiRequest` branches into a windowed path that drives `src/lib/windowed-walk.ts`, a framework-agnostic walker with a persistent cursor; the walker and its live mode flag are held per-provider in `src/lib/use-walker-store.ts` (refs behind method calls, like `useRequestGuard`). A batch is one `page` worth of the collected, deduped items. The mode is opt-in per site and persisted in sessionStorage under `wp-api-explorer.windowed-sites` (a JSON array of canonical site URLs); on connect the mode is on when the site is in that list.

### `RouteNavigator`
- Displays searchable lists of namespaces (e.g. `wp/v2`) and endpoints.
- Tracks `selectedRoute` state (default: `/wp/v2/posts`).

### `FilterPanel` (Query Builder)
- Tracks `queryParams` state as a key-value object.
- Extracts `args` from the route schema and displays corresponding input types:
  - Categories, tags, author, status: text/select input.
  - Pagination (`page`, `per_page`): numeric inputs.
  - Toggle filters: checkbox/switch (`_embed`).
  - Search: standard text input.

### `ResultTabs`
- **Visual Reader:** Inspects the selected route type (using regex like `\/posts$`, `\/media$`, `\/comments$`, `\/users$`). Renders customized visual cards:
  - *Posts:* Displays title, excerpt, featured image (from `_embedded`), publication date, categories/tags, and author avatar.
  - *Media:* Displays image grid or media file lists with copy-url, download buttons, and mime-type badges.
  - *Comments:* Displays hierarchical comment bubbles or lists showing author email, date, and body HTML.
  - *Users:* Card profile layout with avatar, display name, and role.
- **Data Table:** Maps response arrays into dynamic columns of key-value cells.
- **JsonViewer:** COLLAPSIBLE JSON view with code highlighting, full search capability, and a download-as-JSON button.
