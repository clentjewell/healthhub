/**
 * Health Hub CMS — shared helpers: password auth, signed-cookie sessions,
 * GitHub read/write, and content (frontmatter/YAML) parsing.
 */
import yaml from 'js-yaml';

/* ── Repo / config ───────────────────────────────────────────────────────── */

export const REPO = 'clentjewell/healthhub';
export const BRANCH = 'main';
const SESSION_HOURS = 8;

/**
 * The content the CMS can edit. `kind: markdown` = YAML frontmatter + a body;
 * `kind: yaml` = a whole YAML file, no body. Order is the sidebar order.
 */
export const COLLECTIONS = {
  blog: { label: 'Blog posts', dir: 'src/content/blog', ext: '.md', kind: 'markdown', titleField: 'title' },
  pages: { label: 'Page text', dir: 'src/content/pages', ext: '.yml', kind: 'yaml', titleField: 'heading' },
  practitioners: { label: 'Practitioners', dir: 'src/content/practitioners', ext: '.md', kind: 'markdown', titleField: 'name' },
  events: { label: 'Events & classes', dir: 'src/content/events', ext: '.md', kind: 'markdown', titleField: 'title' },
  services: { label: 'Services', dir: 'src/content/services', ext: '.md', kind: 'markdown', titleField: 'title' },
  timetable: { label: 'Timetable', dir: 'src/content/timetable', ext: '.yml', kind: 'yaml', titleField: null },
  faq: { label: 'FAQ', dir: 'src/content/faq', ext: '.yml', kind: 'yaml', titleField: null },
  settings: { label: 'Site settings', dir: 'src/content/settings', ext: '.yml', kind: 'yaml', titleField: null },
};

/* ── Password auth (unchanged behaviour) ─────────────────────────────────── */

const DUMMY_HASH =
  'pbkdf2$sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

export function parseUsers(raw) {
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

export async function verifyLogin(env, email, password) {
  const stored = parseUsers(env.AUTH_USERS).get(String(email || '').trim().toLowerCase());
  const ok = await verifyPbkdf2(password, stored || DUMMY_HASH);
  return stored ? ok : false;
}

async function verifyPbkdf2(password, stored) {
  const p = String(stored).split('$');
  if (p.length !== 5 || p[0] !== 'pbkdf2' || p[1] !== 'sha256') return false;
  const iterations = parseInt(p[2], 10);
  const salt = b64ToBytes(p[3]);
  const expected = b64ToBytes(p[4]);
  if (!iterations || !salt.length || !expected.length) return false;
  const km = await crypto.subtle.importKey('raw', enc(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, km, expected.length * 8);
  return timingSafeEqual(new Uint8Array(bits), expected);
}

/* ── Signed-cookie session (HMAC-SHA256) ─────────────────────────────────── */

export const COOKIE = 'hh_session';

export async function createSession(env, email) {
  const payload = { e: email, x: Date.now() + SESSION_HOURS * 3600 * 1000 };
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmac(env.SESSION_SECRET, body);
  return `${body}.${sig}`;
}

export async function readSession(env, request) {
  const cookie = request.headers.get('Cookie') || '';
  const m = cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [body, sig] = m[1].split('.');
  if (!body || !sig) return null;
  const expect = await hmac(env.SESSION_SECRET, body);
  if (!timingSafeEqual(enc(sig), enc(expect))) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!p.x || p.x < Date.now()) return null;
    return { email: p.e };
  } catch { return null; }
}

export function sessionCookie(value, maxAgeSeconds) {
  const parts = [
    `${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  return parts.join('; ');
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc(data));
  return b64urlEncode(new Uint8Array(sig));
}

/* ── GitHub REST ─────────────────────────────────────────────────────────── */

async function gh(env, method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'healthhub-cms',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

export async function ghList(env, dir, ext) {
  const res = await gh(env, 'GET', `/repos/${REPO}/contents/${dir}?ref=${BRANCH}`);
  if (!res.ok) throw new Error(`list ${dir}: ${res.status}`);
  const items = await res.json();
  return items
    .filter((it) => it.type === 'file' && it.name.endsWith(ext))
    .map((it) => ({ name: it.name, path: it.path }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function ghGet(env, path) {
  const res = await gh(env, 'GET', `/repos/${REPO}/contents/${path}?ref=${BRANCH}`);
  if (!res.ok) throw new Error(`get ${path}: ${res.status}`);
  const data = await res.json();
  return { text: b64ToUtf8(data.content.replace(/\n/g, '')), sha: data.sha };
}

export async function ghPut(env, path, text, sha, message) {
  const res = await gh(env, 'PUT', `/repos/${REPO}/contents/${path}`, {
    message, content: utf8ToB64(text), sha, branch: BRANCH,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`put ${path}: ${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
}

/* ── Content parse / build ───────────────────────────────────────────────── */

// JSON schema = no automatic Date objects for `2026-08-21`; dates stay strings,
// so values round-trip faithfully through the form and back.
const Y_LOAD = { schema: yaml.JSON_SCHEMA };
const Y_DUMP = { lineWidth: -1, noRefs: true, schema: yaml.JSON_SCHEMA };

/** Split a markdown file into { data (frontmatter obj), body }. */
export function parseMarkdown(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  return { data: yaml.load(m[1], Y_LOAD) || {}, body: m[2] ?? '' };
}

export function buildMarkdown(data, body) {
  const fm = yaml.dump(data, Y_DUMP).replace(/\n$/, '');
  return `---\n${fm}\n---\n\n${String(body).replace(/^\n+/, '')}`;
}

export function parseYaml(text) { return yaml.load(text, Y_LOAD) || {}; }
export function buildYaml(obj) { return yaml.dump(obj, Y_DUMP); }
/** Validate a YAML snippet (for scoped sub-editors); throws on bad syntax. */
export function loadYamlSnippet(text) { return yaml.load(text, Y_LOAD); }

/* ── small utils ─────────────────────────────────────────────────────────── */

function enc(s) { return new TextEncoder().encode(String(s)); }
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
function b64ToBytes(b64) {
  try { const s = atob(b64); const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; }
  catch { return new Uint8Array(0); }
}
function b64urlEncode(bytes) {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return b64ToBytes(b64);
}
function b64ToUtf8(b64) { return new TextDecoder().decode(b64ToBytes(b64)); }
function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
