# Go-Live Runbook — Health Hub Tweed Coast

Cutover from the old **WordPress** site to the new **Astro** site on cPanel.

Read this once end-to-end before you start. Do the whole thing in a quiet
window (early morning). Budget ~1 hour; the actual switch is a few minutes.

---

## How it fits together (before you start)

- **Now:** `www.healthhubtweedcoast.com.au` DNS → **cPanel**, serving the old
  **WordPress** site from `/public_html/`. The new site lives on a Cloudflare
  staging URL (`healthhub-tweed-coast.clent.workers.dev`).
- **After:** the same cPanel `/public_html/` serves the new **Astro** site.
  **DNS does not change** — the domain already points at cPanel, so the moment
  `/public_html/` holds the new build, the live site is the new site.
- **How it deploys:** GitHub Actions builds the site and uploads it over FTPS on
  every push to `main` — but only once you switch it on (Phase 4). The CMS keeps
  working: editors Save → commit to `main` → the site rebuilds and re-uploads.
- **The CMS itself** stays on its own Cloudflare Worker; it only edits GitHub.

> Everything below marked ☐ is something **you** do in cPanel / GitHub. Steps
> marked **(Claude)** are quick code changes — ask me and I'll do them in minutes.

---

## Decision to make first: www or non-www?

The old site is `www.healthhubtweedcoast.com.au`. The new site is currently
configured for the **non-www** `healthhubtweedcoast.com.au` (canonical URLs,
sitemap). Pick one **primary** and we redirect the other to it:

- **Keep `www`** (least change for anyone who knows the old address) — **(Claude)**
  I switch the site config to `www` and add a non-www → www redirect.
- **Use non-www** (current config) — **(Claude)** I add a www → non-www redirect.

Tell me which; it's a 5-minute change either way. Do this **before** cutover so
the live site is consistent from minute one.

---

## Phase 1 — Email setup (do any time before launch)

☐ **1.1** cPanel → **Forwarders** → add
`website@healthhubtweedcoast.com.au` → forwards to
`health@pottsvilleacupuncture.com.au`.
(This is the contact form's "from" address. It's a forwarder, not a mailbox, so
no one has to check it — anything sent to it lands in health@. Normal replies go
to the visitor automatically.)

☐ **1.2** cPanel → **Email Deliverability** → confirm **SPF** and **DKIM** show
**Valid** for `healthhubtweedcoast.com.au`. If not, click "Repair".

---

## Phase 2 — GitHub secrets (already done ✅, just verify)

☐ **2.1** Repo → Settings → Secrets and variables → Actions → **Secrets** —
confirm all four exist: `CPANEL_FTP_SERVER`, `CPANEL_FTP_USERNAME`,
`CPANEL_FTP_PASSWORD`, `CPANEL_FTP_DIR`.
(Verified working via a dry-run. `CPANEL_FTP_DIR` is currently `/public_html/`.)

---

## Phase 3 — Test on cPanel first (safe; WordPress stays live)

Deploy the new site into a **subfolder** and check it before touching the live
site.

☐ **3.1** Temporarily change the `CPANEL_FTP_DIR` secret to
`/public_html/hh-preview/`.

☐ **3.2** Repo → **Actions** → *Deploy to cPanel* → **Run workflow** → untick
`dry_run` → Run. Wait for the green tick.

☐ **3.3** Visit `https://www.healthhubtweedcoast.com.au/hh-preview/` and check:
pages load, images show, menu links work, the **contact form sends** a test
message (arrives at the rao@ test inbox for now).
_Note:_ some links point at the site root (`/…`) and will resolve against the
live WordPress site while testing in a subfolder — that's expected; they'll be
correct once the site is at the root.

☐ **3.4** When happy, set `CPANEL_FTP_DIR` back to `/public_html/`, and in
cPanel delete the `/public_html/hh-preview/` folder.

---

## Phase 4 — Go live (the switch)

Do these in order, without long gaps.

☐ **4.1 Switch the contact form to the real inbox — (Claude).** I change
`$RECIPIENT` in `contact.php` from the rao@ test inbox to
`health@pottsvilleacupuncture.com.au`, and (if not already) confirm the
www/non-www decision is applied. Tell me to do this.

☐ **4.2 Back up WordPress.** cPanel → **Backup** → download a **Full Account
Backup** (or at least a `/public_html/` + database backup). Keep it safe — this
is your rollback.

☐ **4.3 Clear the WordPress files.** In cPanel **File Manager**, select
everything inside `/public_html/` and **move** it to a new folder outside the
web root, e.g. `/home/<account>/wp-old-YYYYMMDD/`. (Moving, not deleting, keeps
a second rollback. `/public_html/` should now be empty.)

☐ **4.4 Turn on auto-deploy.** Repo → Settings → Secrets and variables →
Actions → **Variables** → add `CPANEL_DEPLOY_ENABLED` = `true`.

☐ **4.5 Deploy.** Repo → **Actions** → *Deploy to cPanel* → **Run workflow**
(untick `dry_run`) → Run. This uploads the new site into the now-empty
`/public_html/`. Wait for the green tick (~2 min).

---

## Phase 5 — Verify the live site

☐ **5.1** Open `https://www.healthhubtweedcoast.com.au/` — new site loads over
HTTPS, no certificate warning.

☐ **5.2** Click through: Home, Practitioners (+ a profile), Events (+ a class),
Blog (+ a post), FAQ, Contact, Make a Booking. Images load.

☐ **5.3** Submit the **contact form** — confirmation shows, email arrives at
`health@` (or reply to it and confirm it reaches the visitor address).

☐ **5.4** Spot-check a redirect: `…/event/seniors-yoga/` should land on
`…/event/yoga-meditation/`; `…/our-practitioner/shannon-ohara/` → Kate's profile.

☐ **5.5** Old WordPress links still work (they were rebuilt at the same paths):
try a couple of the old page URLs you know.

---

## Phase 6 — Turn on hardening & point the CMS at live

☐ **6.1 HSTS — (Claude).** Once 5.1 confirms HTTPS is solid, I uncomment the
`Strict-Transport-Security` line in `public/.htaccess` and push. (Do this only
after HTTPS is confirmed — it locks the browser to HTTPS.)

☐ **6.2 CMS live preview — (Claude).** I change `SITE` in
`cms-auth/src/index.js` from the Cloudflare staging URL to the live domain and
`wrangler deploy`, so the editor's live preview and "View live" open the real
site.

☐ **6.3** Log into the CMS, make a tiny edit, Save, and confirm it appears live
within a couple of minutes (this proves the whole Save → deploy loop).

---

## Rollback (if something's wrong)

The old site is untouched in the backup and the moved folder:
1. In File Manager, move the new files out of `/public_html/`.
2. Move the WordPress files from `/home/<account>/wp-old-YYYYMMDD/` back into
   `/public_html/`.
3. Set the `CPANEL_DEPLOY_ENABLED` variable to `false` so a CMS save doesn't
   re-deploy over the restored WordPress.
The site is back on WordPress within minutes. Then tell me what went wrong.

---

## After launch — day-to-day

- **Editing content:** staff log into the CMS, edit, Save. The site rebuilds and
  re-uploads to cPanel automatically (~1–2 min). See
  [`EDITING-THE-WEBSITE.md`](EDITING-THE-WEBSITE.md).
- **Adding a class/practitioner/blog post:** "+ Add new" in the CMS.
- **Nothing to maintain on the server** — the deploy is automatic.

---

## Quick reference

| Thing | Value |
| --- | --- |
| Live domain | `www.healthhubtweedcoast.com.au` (pending www/non-www decision) |
| cPanel deploy dir | `/public_html/` (secret `CPANEL_FTP_DIR`) |
| Enable auto-deploy | repo variable `CPANEL_DEPLOY_ENABLED = true` |
| Contact form to | rao@ test inbox → `health@pottsvilleacupuncture.com.au` at launch |
| Contact form from | `website@healthhubtweedcoast.com.au` (forwarder → health@) |
| Redirects & headers | `public/.htaccess` (cPanel) / `public/_headers` + `_redirects` (Cloudflare) |
| CMS | `healthhub-cms-auth.clent.workers.dev` (stays on Cloudflare) |
