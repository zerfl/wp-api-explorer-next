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
