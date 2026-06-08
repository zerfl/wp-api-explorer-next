# WordPress REST API Explorer: Agent Guidelines

This is a modern, fully client-side (with a local CORS proxy helper) WordPress REST API Explorer built with Next.js, Tailwind CSS, TypeScript, and Shadcn UI.

## Project Setup & Scripts
- **Package Manager:** `pnpm`
- **Development Server:** `pnpm dev`
- **Build Command:** `pnpm build`
- **Typecheck & Lint:** `pnpm lint`

## Crucial Agent Coding Standards
To ensure visual consistency and high runtime reliability, you must strictly follow these rules:

1. **Typography Scale:** Avoid using very small font size utilities (like `text-[10px]` or `text-xs` for body text). Maintain the following global hierarchy:
   - Base metadata, small captions, badges, and JSON keys: use `text-xs` (12px) instead of `text-[10px]`.
   - Body copy, standard input text, description labels, and table cells: use `text-sm` (14px) instead of `text-xs`.
   - Titles, route paths, button controls, and primary banners: use `text-base` (16px) instead of `text-sm`.
   - Section headers: use `text-lg` (18px) or `text-xl` (20px).
   
2. **Error Handling (CORS & Requests):** In client components, do not throw javascript exceptions (`throw new Error`) in asynchronous fetch/proxy handlers. Doing so will trigger Next.js development crash screen overlays. Instead:
   - Wrap fetch blocks inside `try/catch`.
   - Extract operational messages gracefully (e.g. using `error instanceof Error ? error.message : String(error)`).
   - Write errors to a local React state variable (e.g. `requestError`) and render them visually via alert components.
   - Use Next.js segment boundaries (`error.tsx`) only for unexpected rendering crashes.

## Project Guidelines & Documentation
To stay within the context budget and avoid bloating, code guidelines, API behaviors, and architecture details are progressively disclosed across the following files:

- For build tools, style rules, and Shadcn setup, see [docs/STACK.md](file:///Users/danielmartin/Code/ai/wp-api-explorer-next/docs/STACK.md).
- For WordPress REST API behaviors, query schemas, and our proxy implementation, see [docs/API_EXPLAINER.md](file:///Users/danielmartin/Code/ai/wp-api-explorer-next/docs/API_EXPLAINER.md).
- For application structure, components list, and state workflow, see [docs/ARCHITECTURE.md](file:///Users/danielmartin/Code/ai/wp-api-explorer-next/docs/ARCHITECTURE.md).

Please reference these documents as needed during your tasks.
