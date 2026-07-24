# Health Hub Tweed Coast

Static [Astro](https://astro.build) site for
[healthhubtweedcoast.com.au](https://healthhubtweedcoast.com.au), deployed on
**Cloudflare Pages**. A fast, mobile-first rebuild of the current WordPress +
Elementor site, styled as a sibling of Pottsville Acupuncture.

This repo also temporarily hosts a **Pottsville-styled `/hub/` proposal page**
(see `/proposals/hub`, added in a later phase) — isolated, `noindex`, and
portable to the Pottsville repo after client sign-off.

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # → dist/
npm run preview    # serve the production build locally
```

Node 22 (`.nvmrc`).

## Deploy — Cloudflare Pages

Static output, no adapter required.

| Setting | Value |
|---|---|
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `22` (via `.nvmrc`) |

> **Preview branch only.** Do **not** point production DNS at this until launch
> (Phase 6 is launch prep; DNS cutover is a manual step, not automated here).

## Project structure

```
src/
  data/site.ts        Single source of truth — NAP, hours, nav, socials
  styles/tokens.css   Pottsville baseline + Health Hub sibling theme
  styles/global.css   Base element styles + helpers
  layouts/            BaseLayout (Health Hub theme, meta/OG scaffold)
  components/          Header, Footer (carry the NAP)
  pages/              Routes
public/               Static assets, robots.txt, favicon
```

## Build phases (review-gated)

1. ✅ **Scaffold + design system** — Astro, CF Pages config, theme, base layout, header/footer w/ NAP.
2. ⬜ Templates with placeholder content + events collection schema.
3. ⬜ Content migration from the live site (copy, bios, images, schedule, booking links).
4. ⬜ Self-serve events (git-based CMS + auth + rebuild).
5. ⬜ SEO layer (JSON-LD, meta/OG, sitemap, robots, llms.txt, redirect map).
6. ⬜ Launch prep (preview build, visual + link + redirect checks). DNS is manual.

See [`DESIGN-TOKENS.md`](DESIGN-TOKENS.md) for the captured design language and
the open design decisions.

## Canonical facts (NAP)

> 87–89 Tweed Coast Road, Hastings Point NSW 2489 · Mon–Sun 8:00am–6:30pm ·
> [@healthhubtweedcoast](https://www.instagram.com/healthhubtweedcoast/)

Edit these in **one place**: `src/data/site.ts`.
