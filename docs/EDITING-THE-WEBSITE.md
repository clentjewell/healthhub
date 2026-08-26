# Editing the website

The Hub team can update most of the website without a developer — page wording,
practitioners, the weekly timetable, events, and the contact details in the
header and footer. You edit in a simple web form; the website rebuilds itself
and goes live a couple of minutes later.

## What you can edit

| In the editor | Covers |
|---|---|
| **Pages** | Wording on Home, Practitioners, Classes & Events, Booking, Contact |
| **Practitioners** | Add / edit / remove team members, their photo, bio, fees, links |
| **Weekly Timetable** | Recurring classes |
| **Upcoming Events** | One-off events, workshops, courses |
| **Settings** | Address, hours, phone, socials, header menu, footer text |

Page *layout* and design stay in code — the editor changes content, not the
structure. Adding a brand-new page is still a developer task.

**Editor address:** `https://healthhubtweedcoast.com.au/admin/`
*(on the preview site: `https://healthhub-tweed-coast.clent.workers.dev/admin/`)*

---

## For the Hub team — day-to-day

### Signing in

1. Go to the editor address above.
2. Click **Sign in with GitHub** and use the GitHub account you were invited with.

If you don't have an account yet, ask us to invite you — see *Adding an editor* below.

### Editing page wording

Open **Pages** and pick the page. Each section is grouped and labelled the way
it appears on the site — e.g. Home has *Hero*, *Welcome*, *Practitioners*,
*Events*, *Find us* and the *"Two ways in"* band. Change the text, **Save**,
then **Publish**.

> The *"Two ways in"* band lives under **Pages → Home**, but it shows at the
> bottom of most pages — editing it changes all of them.

### Adding or removing a practitioner

1. Open **Practitioners** → **New Practitioner**.
2. Fill in **Name**, **Role/title** and **Order** (lower numbers show first).
3. Add a **Photo** (portrait orientation works best), **Phone**, **Booking
   link** and their social links.
4. **Sessions & Fees** — each group becomes a box on their page:
   - a group with **Options** suits classes with passes (e.g. *Casual $24,
     5-pass $110*)
   - a group with a single **price** suits a one-off service (e.g.
     *Initial Consultation — $146*)
5. Write their bio in **Profile / bio**, then **Save** → **Publish**.

To remove someone, open their entry and use **Delete**.

### Editing the header, footer & contact details

Open **Settings → General**. This is the one place the address, hours, phone
and socials live — changing them here updates the footer, contact page, the
homepage "Find us" section and the business details Google reads.

You can also reorder or rename the **header menu** here. Menu links must point
at pages that exist (`/`, `/practitioners`, `/classes-events`, `/contact`,
`/booking`).

### Adding a class to the weekly timetable

1. Open **Weekly Timetable** in the left sidebar → **New Class**.
2. Fill in:
   - **Class name** — e.g. *Hatha & Yin Yoga*
   - **Day** — pick from the list
   - **Start time / End time** — **24-hour clock**: `09:00` is 9am, `18:00` is 6pm
   - **Instructor**, **Level** (e.g. *All levels*) — optional
   - **Category** — sets the small coloured label (Yoga, Pilates, Sound…)
   - **Booking link** — a full `https://…` link, or leave blank if people book by phone
3. Click **Save**, then **Publish**.

> A class that runs twice a week needs **two entries** — one per day/time.

### Pausing a class (instead of deleting it)

Open the class and switch **Show on the timetable** off, then publish. It
disappears from the website but is kept so you can switch it back on later —
handy for school holidays or a teacher away.

### Adding an event

1. Open **Upcoming Events** → **New Event**.
2. Fill in **Event name**, **Date & start time**, **Category** and a short
   **Summary** (one or two sentences — this is what shows on the card).
3. Add an **Image** if you have one (landscape looks best; big photos are fine,
   they're optimised automatically), plus **Price**, **Host** and a
   **Booking link** if relevant.
4. **Feature this event** highlights the card with a coloured border.
5. **Save** → **Publish**.

> **Past events disappear on their own.** Once an event's date has passed it
> stops showing on the website automatically — you don't need to delete it.

### When do changes go live?

Roughly **1–3 minutes** after you hit Publish. Refresh the page to see them.
If a change hasn't appeared after ~5 minutes, tell us — it usually means the
rebuild failed, and the live site simply keeps showing the previous version
(nothing breaks).

### Deleting

Use the **Delete** button inside an entry. Nothing is truly lost — every change
is recorded in the repository history and can be restored.

---

## One-time technical setup

The editor needs a small sign-in helper and two secrets before first use.

### 1. Editor sign-in — ✅ DONE (email + password)

Editors sign in with an **email and password** — no GitHub account needed. A
small worker (in [`/cms-auth`](../cms-auth/)) shows the password screen and, on
a correct password, hands the editor a scoped GitHub token so the CMS can save.

This is already deployed and configured:

- **Worker:** `https://healthhub-cms-auth.clent.workers.dev` (source in `/cms-auth`)
- **Secrets set on it:** `GITHUB_TOKEN` (fine-grained, Contents R/W on this repo),
  `AUTH_USERS` (editor logins), `ALLOWED_ORIGINS` (this site's origins)
- **Rate limiting:** on (KV namespace `RL`, 10 tries per IP per 15 min)
- **CMS pointed at it:** `base_url` in
  [`public/admin/config.yml`](../public/admin/config.yml)

Everything you'd change day-to-day — adding an editor, changing a password,
rotating the GitHub token — is in [`cms-auth/README.md`](../cms-auth/README.md).
Nothing here needs redoing unless you're moving the worker.

### 2. Repository secrets for auto-deploy

Repo → **Settings → Secrets and variables → Actions** → add:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare token created from the **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

These power [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml),
which rebuilds and redeploys on every push to `main` — including the CMS's own
commits. That workflow *is* the "publish" step.

### 3. Adding an editor

Invite them as a **collaborator with write access** to the `clentjewell/healthhub`
repository. Anyone with write access can use the editor; anyone without it can
sign in but cannot save.

---

## How it works (for developers)

```
Editor saves in /admin  →  CMS commits to main (GitHub API)
                        →  GitHub Actions: npm ci → npm run build → wrangler deploy
                        →  live site updated
```

- Editor: **Sveltia CMS**, loaded from a CDN in [`public/admin/index.html`](../public/admin/index.html).
  The config is Decap-compatible, so switching to Decap CMS is a one-line change
  of that script tag.
- Fields in [`public/admin/config.yml`](../public/admin/config.yml) intentionally
  mirror the Zod schemas in [`src/content.config.ts`](../src/content.config.ts).
  **If you add or rename a field in one, mirror it in the other**, or the CMS
  will write content the build rejects.
- URL and optional-text fields are wrapped in `optionalUrl` / `optionalText`
  helpers, which treat an empty string as "not set". Without that, an editor
  clearing a booking link would write `bookingUrl: ""` and fail the build.
- Uploaded event images go to `public/images/events/`.
- A failed build does **not** deploy, so a malformed edit can't take the live
  site down; it just leaves the previous version in place.

### Content architecture

| Content | Lives in | Collection |
|---|---|---|
| Page wording | `src/content/pages/*.yml` | `pages` (file collection) |
| Header/footer/NAP | `src/content/settings/general.yml` | `settings` (file collection) |
| Practitioners | `src/content/practitioners/*.md` | `practitioners` (folder) |
| Classes / events | `src/content/{classes,events}/*.md` | folders |

`src/data/site.ts` deliberately holds **only** build config (canonical domain and
SEO fallbacks) — never content. Components read editable content through
`src/lib/content.ts` (`getSettings()` / `getPage()`), which throws if an entry is
missing so a broken edit fails the build instead of rendering `undefined`.

### Not yet self-serve

Adding or removing whole pages, and changing layout/design, remain developer
tasks. The hero slideshow images are also fixed in code.
