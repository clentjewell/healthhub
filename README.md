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
  data/site.ts        Build config only — canonical domain + SEO fallbacks
  content/settings/   CMS-editable: NAP, hours, header menu, footer
  content/pages/      CMS-editable: page wording
  lib/content.ts      Typed accessors for settings + page copy
  styles/tokens.css   Pottsville baseline + Health Hub sibling theme
  styles/global.css   Base element styles + helpers
  layouts/            BaseLayout (Health Hub theme, meta/OG scaffold)
  components/          Header, Footer (carry the NAP)
  pages/              Routes
public/               Static assets, robots.txt, favicon
```

## Build phases (review-gated)

1. ✅ **Scaffold + design system** — Astro, Cloudflare config, theme, base layout, header/footer w/ NAP.
2. ✅ **Templates + content collections** — page templates, classes/events schemas.
3. ✅ **Content migration** — real copy, bios, images (WebP), booking pathways from the live site.
4. ✅ **Self-serve CMS** — git-based editor at `/admin` + auto-deploy on commit.
   Covers page wording, practitioners (add/edit/delete), timetable, events, and
   header/footer/contact settings.
   See [`docs/EDITING-THE-WEBSITE.md`](docs/EDITING-THE-WEBSITE.md).
   *Needs one-time auth setup before first login.*
5. ✅ **SEO / AEO layer** — JSON-LD (LocalBusiness, Person, Event, OfferCatalog,
   BreadcrumbList, ItemList), written titles and descriptions, OG/Twitter cards
   and share image, sitemap, robots, `/llms.txt`.
   No redirect map is needed — see [URLs](#urls).
6. ⬜ Launch prep (preview build, visual + link checks). DNS is manual.

## URLs

Every route mirrors a URL the live WordPress site already serves, so the
cutover needs **no redirects**. Verified against `wp-sitemap.xml` plus a crawl
of the live site's own links — 22 of 22 live URLs exist here.

| URL | What |
| --- | --- |
| `/` | Home |
| `/our-practitioners/` | Practitioners index (WP page) |
| `/our-practitioner/{slug}/` | Practitioner detail — singular base, as WP has it |
| `/events/` | Events index (WP events archive) |
| `/event/{slug}/` | Event detail — singular base, as WP has it |
| `/make-a-booking/` | Booking |
| `/contact/` | Contact |

The singular `/our-practitioner/` and `/event/` bases are WordPress
conventions. They are kept deliberately: matching them preserves every inbound
link and search ranking without a redirect map. Renaming them to plural later
would need 17 redirects, so treat these paths as fixed.

Two links on the live site are already broken and are **not** reproduced here:
`/our-practitioner/amanda_ross/` and `/our-practitioner/Pearl_Blinco-Doffiny/`
(both 404 on WordPress — underscored duplicates of working pages).

See [`DESIGN-TOKENS.md`](DESIGN-TOKENS.md) for the captured design language and
the open design decisions.

## Canonical facts (NAP)

> 87–89 Tweed Coast Road, Hastings Point NSW 2489 · Mon–Sun 8:00am–6:30pm ·
> [@healthhubtweedcoast](https://www.instagram.com/healthhubtweedcoast/)

Edit these in **one place**: the CMS under **Settings → General**
(`src/content/settings/general.yml`).
