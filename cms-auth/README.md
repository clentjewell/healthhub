# Health Hub CMS login (email + password)

A small Cloudflare Worker that lets editors sign in to `/admin` with an **email
and password** instead of a GitHub account. On a correct password it hands the
Sveltia CMS a pre-provisioned GitHub token so it can save content — the same
approach as the Pottsville password gate, rebuilt for a static Cloudflare site.

The site (`public/admin/config.yml`) already points `base_url` at this worker.
Until the worker is deployed and its secrets are set, `/admin` sign-in will not
work — which is the safe state (nobody can edit).

---

## What you'll set up (all on your side — I can't reach Cloudflare or GitHub)

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
editor@healthhub.example:pbkdf2$sha256$210000$…$…
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
- Failed logins are vague on purpose ("incorrect email or password") and, with
  KV bound, rate-limited.
- The worker is stateless — no sessions, no cookies. The CMS keeps you signed in
  locally after the handshake, so you re-enter the password only occasionally.
