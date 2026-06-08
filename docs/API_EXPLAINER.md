# WordPress REST API & Proxy Explainer

This document outlines how this application interacts with WordPress REST API endpoints, parses schemas, handles CORS issues, and processes data.

## 1. Schema Discovery (`/wp-json/`)
Rather than hardcoding routes and parameters, the application interacts with the WordPress REST API dynamically:
- **Discovery Entrypoint:** When a user inputs a site URL (e.g. `https://techcrunch.com`), the application first tests `GET /wp-json/`.
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
