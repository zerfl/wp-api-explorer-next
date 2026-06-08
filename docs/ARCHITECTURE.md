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

### `SiteSelector`
- Maintains `siteUrl` input and verifies it points to a WordPress site.
- Attempts to discover the API root via `GET /wp-json/`.
- Populates `routes` state from `/wp-json/` index or falls back to core endpoints.
- Lists pre-defined WordPress bookmarks for instant connection.

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
