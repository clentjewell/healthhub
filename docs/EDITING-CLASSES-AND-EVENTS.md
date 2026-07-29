# Editing classes & events

The Hub team can update the **weekly timetable** and **upcoming events** without
a developer. You edit in a simple web form; the website rebuilds itself and goes
live a couple of minutes later.

**Editor address:** `https://healthhubtweedcoast.com.au/admin/`
*(on the preview site: `https://healthhub-tweed-coast.clent.workers.dev/admin/`)*

---

## For the Hub team — day-to-day

### Signing in

1. Go to the editor address above.
2. Click **Sign in with GitHub** and use the GitHub account you were invited with.

If you don't have an account yet, ask us to invite you — see *Adding an editor* below.

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

### 1. GitHub OAuth app

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
2. **Homepage URL:** `https://healthhubtweedcoast.com.au`
3. **Authorization callback URL:** `https://<your-auth-worker>.workers.dev/callback`
4. Note the **Client ID** and generate a **Client Secret**.

### 2. Deploy the auth worker

The editor commits as the signed-in user, so it needs an OAuth relay. Sveltia
publishes a ready-made Cloudflare Worker for this:

```bash
git clone https://github.com/sveltia/sveltia-cms-auth.git
cd sveltia-cms-auth
npx wrangler deploy
# then add the secrets it needs:
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put ALLOWED_DOMAINS   # e.g. healthhubtweedcoast.com.au
```

Copy the deployed worker URL into **`public/admin/config.yml`** →
`backend.base_url`, replacing `https://REPLACE-WITH-YOUR-AUTH-WORKER.workers.dev`.

### 3. Repository secrets for auto-deploy

Repo → **Settings → Secrets and variables → Actions** → add:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare token created from the **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

These power [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml),
which rebuilds and redeploys on every push to `main` — including the CMS's own
commits. That workflow *is* the "publish" step.

### Adding an editor

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

### Not yet self-serve

Practitioner profiles, service copy and page content are still developer-edited.
Adding a `practitioners` collection to `config.yml` is straightforward if the
team wants to manage bios themselves later.
