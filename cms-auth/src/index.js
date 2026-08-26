/**
 * Health Hub CMS — email + password login for the Sveltia/Decap editor.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The stock Sveltia auth worker logs editors in with GitHub OAuth, which means
 * every editor needs their own GitHub account with access to the repo. The
 * client wanted the simpler Pottsville-style experience: an email and a
 * password, no GitHub account. This worker provides exactly that.
 *
 * HOW IT WORKS
 * ────────────
 *   1. The editor opens /admin. Sveltia opens this worker's /auth in a popup.
 *   2. This worker shows an email + password form.
 *   3. On a correct password it hands the CMS a pre-provisioned GitHub token
 *      (a fine-grained PAT stored as a secret here), using the exact postMessage
 *      handshake Sveltia expects — so from the CMS's point of view it's an
 *      ordinary successful login.
 *
 * SECURITY MODEL — READ THIS
 * ──────────────────────────
 * The token this worker holds can write to the content repo. So *anyone who
 * knows an editor password can commit content* (they cannot see the token; it
 * never leaves the worker). That is the same trade-off as Pottsville's password
 * gate. Consequences:
 *   • Use strong, unique passwords. Rotate them by regenerating a hash.
 *   • Scope the GitHub token as tightly as possible: fine-grained PAT, only the
 *     one content repo, Contents = Read and write, nothing else.
 *   • Bind a KV namespace (RL) so failed attempts are rate-limited. Without it
 *     the worker still runs but cannot throttle brute force.
 *
 * SECRETS / BINDINGS (set via `wrangler secret put` or the dashboard):
 *   GITHUB_TOKEN     fine-grained PAT, Contents R/W on the content repo
 *   AUTH_USERS       one editor per line: "email:pbkdf2$sha256$<iter>$<saltB64>$<hashB64>"
 *                    generate a line with: node cms-auth/hash-password.mjs
 *   ALLOWED_ORIGINS  comma-separated site origins allowed to receive the token,
 *                    e.g. "https://healthhub-tweed-coast.clent.workers.dev,https://www.healthhubtweedcoast.com.au"
 *   RL  (optional)   KV namespace binding for rate limiting
 */

const PBKDF2_ITERATIONS = 100000;
const RL_MAX_ATTEMPTS = 10; // per IP per window
const RL_WINDOW_SECONDS = 900; // 15 minutes

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/auth') {
      if (request.method === 'GET') return loginPage(env, '');
      if (request.method === 'POST') return handleLogin(request, env);
      return new Response('Method Not Allowed', { status: 405, headers: baseHeaders() });
    }

    // Health check / anything else.
    return new Response('Health Hub CMS auth. Open /admin on the site to sign in.', {
      status: url.pathname === '/' ? 200 : 404,
      headers: baseHeaders(),
    });
  },
};

/* ── Login handling ──────────────────────────────────────────────────────── */

async function handleLogin(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  if (await isRateLimited(env, ip)) {
    return loginPage(env, 'Too many attempts. Please wait a few minutes and try again.', 429);
  }

  const form = await request.formData();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');

  const ok = await verifyCredentials(env, email, password);
  if (!ok) {
    await recordFailure(env, ip);
    // Deliberately vague — don't reveal whether the email exists.
    return loginPage(env, 'Incorrect email or password.', 401);
  }

  if (!env.GITHUB_TOKEN) {
    return loginPage(env, 'Server not configured: missing GITHUB_TOKEN.', 500);
  }
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  return handshakePage(env.GITHUB_TOKEN, allowed);
}

async function verifyCredentials(env, email, password) {
  const users = parseUsers(env.AUTH_USERS);
  const stored = users.get(email);
  if (!stored) return false;
  return verifyPbkdf2(password, stored);
}

/** Parse "email:hash" lines (comments and blanks ignored). */
function parseUsers(raw) {
  const map = new Map();
  for (const line of String(raw || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf(':');
    if (i === -1) continue;
    map.set(t.slice(0, i).trim().toLowerCase(), t.slice(i + 1).trim());
  }
  return map;
}

/** Verify a password against "pbkdf2$sha256$<iter>$<saltB64>$<hashB64>". */
async function verifyPbkdf2(password, stored) {
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const iterations = parseInt(parts[2], 10);
  const salt = b64ToBytes(parts[3]);
  const expected = b64ToBytes(parts[4]);
  if (!iterations || !salt.length || !expected.length) return false;

  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial, expected.length * 8,
  );
  return timingSafeEqual(new Uint8Array(bits), expected);
}

/* ── Rate limiting (optional KV) ─────────────────────────────────────────── */

async function isRateLimited(env, ip) {
  if (!env.RL) return false;
  const n = parseInt((await env.RL.get(`fail:${ip}`)) || '0', 10);
  return n >= RL_MAX_ATTEMPTS;
}
async function recordFailure(env, ip) {
  if (!env.RL) return;
  const key = `fail:${ip}`;
  const n = parseInt((await env.RL.get(key)) || '0', 10) + 1;
  await env.RL.put(key, String(n), { expirationTtl: RL_WINDOW_SECONDS });
}

/* ── Pages ───────────────────────────────────────────────────────────────── */

function loginPage(env, error, status = 200) {
  const brand = 'Health Hub Tweed Coast';
  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Sign in · ${brand}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background:#eaf5f6; color:#2a3742; margin:0; min-height:100vh; display:grid; place-items:center; }
  .card { background:#fff; width:min(92vw,360px); padding:32px 28px; border-radius:12px;
    box-shadow:0 10px 40px rgba(0,0,0,.08); }
  h1 { font-size:1.15rem; margin:0 0 4px; } p.sub { margin:0 0 20px; color:#5c6b75; font-size:.9rem; }
  label { display:block; font-size:.8rem; font-weight:600; margin:14px 0 6px; }
  input { width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #cdd8dc;
    border-radius:8px; font-size:1rem; }
  button { width:100%; margin-top:22px; padding:11px; border:0; border-radius:8px; background:#2b8a9a;
    color:#fff; font-size:1rem; font-weight:600; cursor:pointer; }
  button:hover { background:#247685; }
  .err { background:#fdecec; border:1px solid #f5b5b5; color:#a12; padding:10px 12px;
    border-radius:8px; font-size:.85rem; margin-bottom:16px; }
</style></head><body>
  <form class="card" method="POST" action="/auth" autocomplete="on">
    <h1>${brand}</h1>
    <p class="sub">Sign in to edit the website.</p>
    ${error ? `<div class="err">${escapeHtml(error)}</div>` : ''}
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required autocomplete="username" autofocus>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" required autocomplete="current-password">
    <button type="submit">Sign in</button>
  </form>
</body></html>`;
  return new Response(html, { status, headers: { ...baseHeaders(), 'Content-Type': 'text/html; charset=utf-8' } });
}

/**
 * The Sveltia/Decap popup handshake. The popup announces itself to the opener
 * (the CMS), waits for the CMS to reply, then posts the token back to the exact
 * origin the reply came from — so the token only ever goes to the CMS window.
 */
function handshakePage(token, allowedOrigins) {
  const payload = JSON.stringify({ provider: 'github', token });
  // The token is posted only to an origin on the allow-list, so a page on some
  // other origin that opened this popup can never receive it. An empty list
  // (misconfiguration) accepts none — fail closed rather than leak the token.
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Signing in…</title></head>
<body><script>
  (function () {
    var allowed = ${JSON.stringify(allowedOrigins)};
    function receive(e) {
      if (e.data !== 'authorizing:github') return;
      if (allowed.indexOf(e.origin) === -1) return;
      window.opener.postMessage(
        'authorization:github:success:' + ${JSON.stringify(payload)}, e.origin);
      window.removeEventListener('message', receive);
    }
    window.addEventListener('message', receive, false);
    window.opener.postMessage('authorizing:github', '*');
  })();
</script><p style="font-family:sans-serif">Signing you in…</p></body></html>`;
  return new Response(html, { status: 200, headers: { ...baseHeaders(), 'Content-Type': 'text/html; charset=utf-8' } });
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function baseHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  };
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
function b64ToBytes(b64) {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return new Uint8Array(0); }
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const _PBKDF2_ITERATIONS = PBKDF2_ITERATIONS; // referenced by hash-password.mjs
