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

The Pottsville family is **Noah** (body/UI) + **Reborn** (uppercase display
headings) — both **geometric sans**. These are licensed fonts; the client
supplied the files, so we **self-host them** (`src/styles/fonts.css`,
`public/fonts/*.woff2`) for exact parity. Both are sans — there is **no serif**
in the design language.

> The Bebas Neue / Cormorant Garamond / Raleway that appear on the live
> `/hub/` page are **stray leftover `<link>`s, not the design** — an early
> version of this build wrongly adopted them. Corrected.

| Role | Font | Weights supplied |
|---|---|---|
| Headings + wordmark (UPPERCASE) | **Reborn** | 400 |
| Body / UI | **Noah** | 700 (bold), 900 (black), 400 italic |

Type scale (matches Pottsville): `h1 clamp(2.4rem,5.5vw,4.5rem)` ·
`h2 clamp(1.9rem,4vw,3.2rem)` · `h3 clamp(1.3rem,2.4vw,1.8rem)`. Heading
line-height `1.15`, body `1.55`. Headings uppercase, `letter-spacing .01em`.

> **DECISION 1 — fonts → RESOLVED (Path A, exact parity).** Noah + Reborn are
> self-hosted from the supplied files. Fonts subset to Latin + converted to
> WOFF2.
>
> **⚠️ Still needed for full parity — Noah UPRIGHT text weights:**
> **Regular 400** (primary body copy — most important), **Medium 500**,
> **SemiBold 600**. These weren't in the supplied set, so upright body/UI text
> currently falls back to **Mulish** (a close free geometric sans). Bold,
> black and italic already render in real Noah. Drop the woff2 files in
> `public/fonts/`, add the `@font-face` blocks (templated in `fonts.css`), and
> remove Mulish — a ~3-line change.

## 3. Layout & shape

- Container `1180px`, narrow `780px`, gutter `24px`
- Section rhythm `96px` (→ `64px` on mobile)
- Radius `4px` (buttons/chips), `6px` (cards/images)

## 4. Health Hub sibling theme (aligned to the OFFICIAL logo)

Goal: *same family, distinct identity.* The **official Health Hub Tweed Coast
logo** (supplied by the client) is a **blue + turquoise** enso with a gold
chakra dot. The theme is matched to it — a cool blue sibling of Pottsville's
warm teal:

| Semantic token | Pottsville (default) | Health Hub (from logo) |
|---|---|---|
| page background | paper `#FAF8F4` | white `#FFFFFF` |
| section tint | pale teal `#EFFAFA` | pale turquoise `#EAF5F6` |
| headings | deep teal `#0D6E70` | **steel-blue `#34719F`** (wordmark) |
| accent / eyebrow | bright teal `#1DBFC1` | **turquoise `#2E9FA4`** (`#45C2C6` bright, for detail) |
| primary button | deep teal | **steel-blue `#34719F`** → navy `#22496C` hover |
| dark section band | deep teal | **navy `#22496C`** |
| spark / active | gold `#F4B400` (stars) | **gold `#F2B01E`** (chakra dot) |
| borders | grey `#D9D9D9` | cool `#DCE6EB` |

The header wordmark mirrors the logo's two-tone treatment: blue "HEALTH HUB" +
turquoise "TWEED COAST".

> **DECISION 2 — Health Hub identity → RESOLVED.** Palette matched to the
> official logo (blue/turquoise/gold). Hexes were sampled by eye from the
> supplied artwork; if a brand sheet has exact values, they're a one-file swap
> in `tokens.css`. *(The earlier earthy pine/clay/sand proposal — used before
> the logo was supplied — has been replaced.)*

> **DECISION 3 — logo → OUTSTANDING.** The header still renders a **typographic
> wordmark** (Bebas Neue "HEALTH HUB" + turquoise "Tweed Coast"), recoloured to
> match the logo. To use the **actual logo artwork** in the header/footer,
> please send the file — **SVG preferred** (crisp at any size), otherwise a
> high-res transparent PNG. I'll drop it in and keep the wordmark as the
> text/SEO fallback.

## How the two themes coexist

`tokens.css` defines shared **primitives** (raw Pottsville hexes), then a default
`:root` **semantic** layer (= Pottsville) and a `[data-theme="healthhub"]`
override. `BaseLayout.astro` sets `data-theme="healthhub"`; the `/proposals/hub`
page (Prompt 2) will use its own layout with the default theme — so porting the
proposal to the Pottsville repo stays close to copy-paste.
