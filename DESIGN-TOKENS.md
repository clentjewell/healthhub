# Design tokens — Pottsville baseline & Health Hub sibling theme

This document captures the Pottsville Acupuncture design language (the shared
family) and the proposed Health Hub sibling variant. It is the reference for
**both** builds in this repo:

- the **Health Hub site** (Prompt 1) → uses the `healthhub` theme
- the **Pottsville `/hub/` proposal** (Prompt 2) → uses the default (Pottsville) theme

Tokens live in [`src/styles/tokens.css`](src/styles/tokens.css). This file is the
human-readable rationale + decisions.

## Source

Pottsville repo access was **not** available this session (GitHub scope was
limited to `clentjewell/healthhub`), so the baseline was extracted from the live
site as the brief specifies:

- `https://pottsvilleacupuncture.com.au/hub/` (page markup + inline styles)
- `https://pottsvilleacupuncture.com.au/styles.css` (main stylesheet, `:root` tokens)

## 1. Colours (Pottsville baseline — captured verbatim)

| Token | Hex | Role |
|---|---|---|
| deep teal | `#0D6E70` | **Primary brand** — headings, primary buttons (confirmed) |
| bright teal | `#1DBFC1` | Accent, button hover, eyebrows |
| bright teal (hover) | `#17B9BC` | — |
| pale teal | `#EFFAFA` | Section tint wash |
| paper | `#FAF8F4` | Warm off-white page background |
| ink | `#3A3A3A` | Body text |
| greys | `#383838 · #6B6B6B · #BFBDBA · #D9D9D9 · #EDEBEA · #F5F4F1` | UI greys |
| gold | `#F4B400` | Review stars |

Pottsville's own CSS also defines an earthy **`hub` sub-palette** (already named
for the Hub): sand `#E9DEC9`, clay `#C97B5C`, pine `#2F4A3A`. This is the basis
for the Health Hub identity below. (It also defines a "mermaid" sub-palette —
turquoise/pink/coral/purple — not used here.)

## 2. Typography

The **production** Pottsville site uses licensed fonts (**Qurova**, **Noah**,
**Reborn**) delivered as `.otf` from the Pottsville repo. **These cannot be
redistributed**, so we map to the open Google Fonts the Pottsville `/hub/` page
itself already loads — same editorial character, freely licensable:

| Role | Font | Substitutes for |
|---|---|---|
| Display / brand wordmark | **Bebas Neue** (condensed, uppercase) | Reborn |
| Editorial headings & pull-quotes | **Cormorant Garamond** (serif) | — (the "editorial type") |
| Body & UI | **Raleway** (sans) | Noah |

Type scale (matches Pottsville): `h1 clamp(2.4rem,5.5vw,4.5rem)` ·
`h2 clamp(1.9rem,4vw,3.2rem)` · `h3 clamp(1.3rem,2.4vw,1.8rem)`. Heading
line-height `1.15`, body `1.55`. Eyebrow: 11px, `letter-spacing .25em`, uppercase.

> **DECISION 1 — fonts.** We ship Bebas Neue / Cormorant Garamond / Raleway
> (open) rather than the licensed Qurova/Noah/Reborn. If Maxxim holds a web
> licence for the production fonts and wants exact parity, we can swap them in
> via `@font-face` — one change in `tokens.css`. **Confirm which you want.**

## 3. Layout & shape

- Container `1180px`, narrow `780px`, gutter `24px`
- Section rhythm `96px` (→ `64px` on mobile)
- Radius `4px` (buttons/chips), `6px` (cards/images)

## 4. Health Hub sibling theme (PROPOSED — needs sign-off)

Goal: *same family, distinct identity.* The Health Hub theme keeps **deep teal
`#0D6E70` as the primary action colour** so the two sites are unmistakably
siblings, then diverges to feel warmer and more "studio / community":

| Semantic token | Pottsville (default) | Health Hub (proposed) |
|---|---|---|
| page background | paper `#FAF8F4` | warm sand `#FBF8F2` |
| headings | deep teal `#0D6E70` | **pine `#2F4A3A`** |
| accent / eyebrow | bright teal `#1DBFC1` | **clay `#C97B5C`** |
| primary button | deep teal | deep teal *(shared — family link)* |
| dark section band | deep teal | **pine `#2F4A3A`** |
| borders | grey `#D9D9D9` | warm `#E6DDCD` |

> **DECISION 2 — Health Hub identity.** The above (teal + earthy pine/clay/sand)
> is derived directly from Pottsville's own `--hub-*` tokens and reads as a
> grounded studio sibling. **Alternative on file:** the existing "Health Hub
> Tweed Coast" cross-promo band on the Pottsville site uses a cooler
> **slate-blue** (`#46688C → #537EA6`) with a turquoise `#36C7C4` accent — a
> cooler, more clinical sibling. Both are one-file swaps in `tokens.css`.
> **Which direction do you want?**

> **DECISION 3 — logo.** No Health Hub logo asset was available. The header
> currently renders a **typographic wordmark** (Bebas Neue "HEALTH HUB" +
> "Tweed Coast"). If a real logo exists, send it and we'll drop it in.

## How the two themes coexist

`tokens.css` defines shared **primitives** (raw Pottsville hexes), then a default
`:root` **semantic** layer (= Pottsville) and a `[data-theme="healthhub"]`
override. `BaseLayout.astro` sets `data-theme="healthhub"`; the `/proposals/hub`
page (Prompt 2) will use its own layout with the default theme — so porting the
proposal to the Pottsville repo stays close to copy-paste.
