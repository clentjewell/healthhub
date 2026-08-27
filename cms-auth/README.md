# Health Hub CMS (email + password)

A Cloudflare Worker that is the whole content editor: sign in with an **email
and password**, edit content in plain forms, click Save — which commits to
GitHub and rebuilds the site. No GitHub accounts for editors; the repo token
stays on the server and never reaches the browser. The Pottsville-style
experience, rebuilt for a static Cloudflare site (no PHP).

The site's `/admin` redirects here (see `public/_redirects`). Editors never see
GitHub or Sveltia.

**Adding / changing an editor:** generate a line with `node hash-password.mjs
their@email`, then update the `AUTH_USERS` secret (`npx wrangler secret put
AUTH_USERS`) with one line per editor.

## Status: LIVE ✅

Deployed to `https://healthhub-cms-auth.clent.workers.dev` with all three
secrets set (`GITHUB_TOKEN`, `AUTH_USERS`, `ALLOWED_ORIGINS`) and the `RL` KV
throttle bound. Editors sign in at `/admin/`. The steps below are the reference
for redeploying, moving the worker, or setting it up from scratch again.

---

## Setup from scratch (reference)

You need: the Cloudflare account that owns `clent.workers.dev`, permission to
create a GitHub token on `clentjewell/healthhub`, and Node installed locally.

### 1. Create the GitHub token the worker will hold

GitHub → Settings → Developer settings → **Fine-grained personal access tokens**
→ Generate new token:

- **Resource owner:** clentjewell
- **Repository access:** Only select repositories → `clentjewell/healthhub`
- **Permissions:** Repository → **Contents: Read and write** (nothing else)
- **Expiration:** your call — a dated expiry is safer but means re-issuing later.

Copy the token (starts with `github_pat_`). Treat it like a password.

> Best practice: make the token belong to a dedicated "machine" GitHub account
> that only has access to this one repo, so commits show as that account and the
> token can't touch anything else. A personal token works too.

### 2. Make a password hash for each editor

From the repo root:

```
node cms-auth/hash-password.mjs editor@healthhub.example
```

It asks for a password (min 10 chars, hidden) and prints one line:

```
editor@healthhub.example:pbkdf2$sha256$100000$…$…
```

Run it once per editor. Collect the lines together — that's your `AUTH_USERS`
value. The passwords themselves are never stored, only these one-way hashes.

### 3. Deploy the worker

```
cd cms-auth
npx wrangler deploy
```

That publishes it to `https://healthhub-cms-auth.clent.workers.dev` (the name in
`wrangler.toml`, which matches `base_url` in the site config).

### 4. Set the secrets

```
cd cms-auth
npx wrangler secret put GITHUB_TOKEN       # paste the token from step 1
npx wrangler secret put AUTH_USERS         # paste the editor line(s) from step 2
npx wrangler secret put ALLOWED_ORIGINS    # see below
```

`ALLOWED_ORIGINS` is the comma-separated list of site origins allowed to receive
the token. Use both the staging and live origins so it keeps working at cutover:

```
https://healthhub-tweed-coast.clent.workers.dev,https://www.healthhubtweedcoast.com.au
```

### 5. (Recommended) Turn on rate limiting

```
cd cms-auth
npx wrangler kv namespace create RL
```

Paste the returned `id` into the `[[kv_namespaces]]` block in `wrangler.toml`,
uncomment it, and `npx wrangler deploy` again. This throttles password guessing
(10 tries per IP per 15 min). The worker runs without it, just unthrottled.

### 6. Test

Open `https://healthhub-tweed-coast.clent.workers.dev/admin/`, sign in with an
editor email + password. You should land in the editor. Make a tiny content
edit and save — it should commit to `main` and the site should rebuild.

---

## Day-to-day

- **Add / remove an editor:** regenerate the `AUTH_USERS` secret with the new set
  of lines (`wrangler secret put AUTH_USERS`) and redeploy is not needed —
  secrets take effect immediately.
- **Change a password:** regenerate that editor's line and update `AUTH_USERS`.
- **Rotate the GitHub token:** issue a new one, `wrangler secret put GITHUB_TOKEN`.

## Security notes (worth understanding)

- Anyone who knows an editor password can commit content (they never see the
  token — it stays in the worker). So passwords must be strong and unique, and
  the token is deliberately scoped to *content only, this repo only*.
- The token is only ever posted to an origin in `ALLOWED_ORIGINS`.
- Failed logins are vague on purpose ("incorrect email or password") and are
  rate-limited (10 per IP per 15 min via the `RL` KV store). The KDF is also run
  for unknown emails, so response timing can't be used to enumerate editors.
- A cross-site page can't drive the login: a foreign `Origin` on the POST is
  rejected (CSRF guard).
- The worker is stateless — no sessions, no cookies. The CMS keeps you signed in
  locally after the handshake, so you re-enter the password only occasionally.

## Local testing & active scanning (safe)

Never point an active scanner at the live worker — it holds a repo-write token.
Instead scan a **local copy with dummy secrets**:

```
cd cms-auth
cp .dev.vars.example .dev.vars   # dummy GITHUB_TOKEN — worthless if extracted
npx wrangler dev --port 8788     # worker at http://localhost:8788
```

Then run OWASP ZAP against `http://localhost:8788` — or just run the bundled
helper, which starts the worker and runs ZAP's baseline + full active scan for
you (needs Docker):

```
cd cms-auth
./scan-local.sh                  # reports land in cms-auth/scan-report/
```

The dummy token means that even if the scanner's payloads extracted it, it
reaches nothing. `.dev.vars` and `scan-report/` are git-ignored.
