# Technology Stack & Styling Conventions

This document outlines the tools, packages, styling system, and code quality expectations for the WordPress API Explorer.

## Technology Stack
- **Framework:** Next.js (App Router, `/src` directory layout)
- **Language:** TypeScript (strict mode enabled)
- **Package Manager:** `pnpm`
- **Styling:** Tailwind CSS & standard CSS variables (dark mode by default)
- **UI Components:** Shadcn UI (Radix primitives + Tailwind)
- **Icons:** `lucide-react`

## Style Conventions & UI Design
- **Dark Mode by default:** We use a modern, glassmorphic dark interface with harmonious HSL variables. The main content containers should feel premium (using subtle gradients, `backdrop-blur` and border overlays).
- **Typography & Font Scale:** Outfit or Inter font family (using Geist variable `--font-geist-sans` inside Tailwind configs). To maintain visual hierarchy and readability, we avoid extremely tiny text and use the following consistent scale:
  - Base metadata, small captions, badges, and JSON keys: use `text-xs` (12px) instead of `text-[10px]`.
  - Body copy, standard input text, description labels, and table cells: use `text-sm` (14px) instead of `text-xs`.
  - Titles, route paths, button controls, and primary banners: use `text-base` (16px) instead of `text-sm`.
  - Main section headings and connecting selectors headers: use `text-lg` (18px) or `text-2xl` (24px) for page hero layouts.
- **Animations:** Smooth hover states, progressive loading skeletons, and soft slide-ins for results.
- **Zero Placeholders:** When an image, avatar, or link is referenced (e.g. for authors, featured media), we dynamically fallback to beautiful, generated SVG placeholders or standard icons if they aren't provided by the WordPress site.

## Adding Shadcn UI Components
If you need to install a new Shadcn UI component:
- Run: `pnpm dlx shadcn@latest add <component-name>`
- Do not add manual styling workarounds when Shadcn UI utility classes can achieve it.

## Quality Rules
- Ensure proper TypeScript types for WordPress API resources (avoid using `any`).
- Follow accessibility (a11y) standards: use semantic HTML tags (`<header>`, `<nav>`, `<main>`, `<section>`), proper `aria` labels, and keyboard navigability.
