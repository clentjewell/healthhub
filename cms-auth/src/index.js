/**
 * Health Hub CMS — a simple, password-gated content editor on Cloudflare.
 *
 * Sign in with email + password → edit content in plain forms → Save commits to
 * GitHub, which rebuilds and deploys the site. No GitHub account for editors;
 * the repo token stays on the server and never reaches the browser.
 *
 * Secrets/bindings: GITHUB_TOKEN, AUTH_USERS, SESSION_SECRET, RL (KV).
 */
import {
  COLLECTIONS, verifyLogin, createSession, readSession, sessionCookie,
  ghList, ghGet, ghPut, parseMarkdown, buildMarkdown, parseYaml, buildYaml,
  loadYamlSnippet, ghTree, ghGetOrNull, ghPutBinary, readManifest, writeManifest,
} from './lib.js';
import { APP_JS } from './app-js.js';

// Where images live in the repo and how the CMS shows thumbnails (the live site).
const IMG_PREFIX = 'public/images/';
const SITE = 'https://healthhub-tweed-coast.clent.workers.dev';
const IMG_EXT = /\.(webp|jpe?g|png|gif|avif|svg)$/i;
const MAX_UPLOAD = 8 * 1024 * 1024; // 8 MB

// Collections edited with a structured (repeatable-row) editor instead of the
// generic field form. Their whole value is submitted as JSON by app.js.
const STRUCTURED = { timetable: true, faq: true };

const RL_MAX = 10, RL_WINDOW = 900;

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (e) {
      return page('Something went wrong', `<div class="card"><h1>Something went wrong</h1>
        <p class="err">${esc(e.message || String(e))}</p>
        <p><a href="/">Back to the dashboard</a></p></div>`, 500);
    }
  },
};

async function route(request, env) {
  const url = new URL(request.url);
  const p = url.pathname;
  const session = await readSession(env, request);

  if (p === '/app.js') {
    return new Response(APP_JS, {
      headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  }
  if (p === '/login' && request.method === 'POST') return doLogin(request, env);
  if (p === '/logout') {
    return redirect('/login', { 'Set-Cookie': sessionCookie('', 0) });
  }

  // Everything below needs a session.
  if (!session) {
    if (p === '/login' || p === '/') return loginPage();
    return redirect('/login');
  }

  if (p === '/' || p === '/login') return dashboard();
  if (p === '/c' && url.searchParams.get('k')) return listCollection(env, url.searchParams.get('k'));
  if (p === '/edit') return editForm(env, url.searchParams.get('k'), url.searchParams.get('path'));
  if (p === '/save' && request.method === 'POST') return doSave(request, env);
  if (p === '/media') return mediaPage(env, url.searchParams.get('path'));
  if (p === '/media/upload' && request.method === 'POST') return doUpload(request, env);
  if (p === '/media/save' && request.method === 'POST') return doMediaSave(request, env);
  return redirect('/');
}

/* ── Login ───────────────────────────────────────────────────────────────── */

async function doLogin(request, env) {
  const selfOrigin = new URL(request.url).origin;
  const origin = request.headers.get('Origin');
  if (origin && origin !== 'null' && origin !== selfOrigin) return new Response('Bad origin', { status: 403 });

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (await rateLimited(env, ip)) return loginPage('Too many attempts. Please wait a few minutes.');

  const form = await request.formData();
  const email = String(form.get('email') || '');
  const ok = await verifyLogin(env, email, String(form.get('password') || ''));
  if (!ok) { await bumpFail(env, ip); return loginPage('Incorrect email or password.'); }

  const value = await createSession(env, email.trim().toLowerCase());
  return redirect('/', { 'Set-Cookie': sessionCookie(value, 28800) });
}

async function rateLimited(env, ip) {
  if (!env.RL) return false;
  return parseInt((await env.RL.get(`fail:${ip}`)) || '0', 10) >= RL_MAX;
}
async function bumpFail(env, ip) {
  if (!env.RL) return;
  const n = parseInt((await env.RL.get(`fail:${ip}`)) || '0', 10) + 1;
  await env.RL.put(`fail:${ip}`, String(n), { expirationTtl: RL_WINDOW });
}

/* ── Pages ───────────────────────────────────────────────────────────────── */

function dashboard() {
  const cards = Object.entries(COLLECTIONS).map(([k, c]) =>
    `<a class="tile" href="/c?k=${k}"><span class="tile-t">${esc(c.label)}</span>
      <span class="tile-a">Open →</span></a>`).join('');
  return shell('Website Manager', `
    <div class="head"><h1>Website Manager</h1><a class="ghost" href="/logout">Sign out</a></div>
    <p class="sub">Choose what to edit. Changes go live a minute or so after you save.</p>
    <div class="tiles">${cards}
      <a class="tile" href="/media"><span class="tile-t">Media library</span>
        <span class="tile-a">Images &amp; uploads →</span></a></div>`);
}

/* ── Media library ───────────────────────────────────────────────────────── */

async function mediaPage(env, focusPath) {
  const [paths, manifest] = await Promise.all([ghTree(env, IMG_PREFIX), readManifest(env)]);
  const images = paths.filter((p) => IMG_EXT.test(p)).sort();
  const folders = [...new Set(images.map((p) => p.slice(IMG_PREFIX.length).split('/').slice(0, -1).join('/')).filter(Boolean))].sort();

  // Detail view for one image.
  if (focusPath) {
    const rel = focusPath.replace(/^public\//, '');
    const meta = manifest.map[focusPath] || {};
    return shell('Image details', `
      <div class="head"><h1>Image details</h1><a class="ghost" href="/media">← Media library</a></div>
      <div class="mdetail">
        <img class="mprev" src="${SITE}/${esc(rel)}" alt="">
        <form method="POST" action="/media/save">
          <input type="hidden" name="path" value="${esc(focusPath)}">
          <p class="mpath">${esc(focusPath.slice(IMG_PREFIX.length))}</p>
          <label class="fl"><span class="fk">Title</span><input class="in" name="title" value="${esc(meta.title || '')}"></label>
          <label class="fl"><span class="fk">Alt text <em>(describes the image for screen readers &amp; SEO)</em></span>
            <input class="in" name="alt" value="${esc(meta.alt || '')}"></label>
          <label class="fl"><span class="fk">Description</span>
            <textarea class="ta" name="description" rows="3">${esc(meta.description || '')}</textarea></label>
          <label class="fl"><span class="fk">Path (use this in a content image field)</span>
            <input class="in" value="/${esc(rel)}" readonly onclick="this.select()"></label>
          <div class="actions"><button class="btn" type="submit">Save details</button>
            <a class="ghost" href="/media">Back</a></div>
        </form>
      </div>`);
  }

  const cards = images.map((p) => {
    const rel = p.replace(/^public\//, '');
    const m = manifest.map[p] || {};
    return `<a class="mcard" href="/media?path=${encodeURIComponent(p)}">
      <span class="mthumb"><img loading="lazy" src="${SITE}/${esc(rel)}" alt=""></span>
      <span class="mname">${esc(p.slice(IMG_PREFIX.length))}</span>
      ${m.alt ? `<span class="mmeta">alt ✓</span>` : `<span class="mmeta warn">no alt</span>`}</a>`;
  }).join('');

  const folderOpts = ['(top level)', ...folders].map((f) =>
    `<option value="${f === '(top level)' ? '' : esc(f)}">${esc(f)}</option>`).join('');

  return shell('Media library', `
    <div class="head"><h1>Media library</h1><a class="ghost" href="/">← All sections</a></div>
    <form class="upload" method="POST" action="/media/upload" enctype="multipart/form-data">
      <h2 class="uh">Upload a new image</h2>
      <div class="urow">
        <label class="fl"><span class="fk">Image file</span><input class="in" type="file" name="file" accept="image/*" required></label>
        <label class="fl"><span class="fk">Folder</span><select class="in" name="folder">${folderOpts}</select></label>
      </div>
      <div class="urow">
        <label class="fl"><span class="fk">Alt text</span><input class="in" name="alt" placeholder="What the image shows"></label>
        <label class="fl"><span class="fk">Title</span><input class="in" name="title"></label>
      </div>
      <label class="fl"><span class="fk">Description</span><textarea class="ta" name="description" rows="2"></textarea></label>
      <div class="actions"><button class="btn" type="submit">Upload</button>
        <span class="hint">Max 8 MB. Best to resize large photos before uploading.</span></div>
    </form>
    <p class="sub">${images.length} images. Click one to edit its details or copy its path.</p>
    <div class="mgrid">${cards}</div>`);
}

async function doUpload(request, env) {
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.name) return mediaPage(env, null);
  if (!IMG_EXT.test(file.name)) return errorPage('That file type isn’t a supported image (webp, jpg, png, gif, avif, svg).');
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.length > MAX_UPLOAD) return errorPage('That image is larger than 8 MB — please resize it and try again.');

  const folder = String(form.get('folder') || '').replace(/[^a-z0-9/-]/gi, '');
  const base = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
  const path = `${IMG_PREFIX}${folder ? folder + '/' : ''}${base}`;

  if (await ghGetOrNull(env, path)) return errorPage(`An image named “${esc(base)}” already exists in that folder. Rename the file and upload again.`);

  await ghPutBinary(env, path, buf, `media: add ${path} (via CMS)`);

  // Save metadata.
  const alt = String(form.get('alt') || ''); const title = String(form.get('title') || ''); const description = String(form.get('description') || '');
  if (alt || title || description) {
    const { map, sha } = await readManifest(env);
    map[path] = { alt, title, description };
    await writeManifest(env, map, sha, `media: metadata for ${path}`);
  }
  return redirect(`/media?path=${encodeURIComponent(path)}`);
}

async function doMediaSave(request, env) {
  const form = await request.formData();
  const path = String(form.get('path') || '');
  if (!path) return redirect('/media');
  const { map, sha } = await readManifest(env);
  map[path] = {
    alt: String(form.get('alt') || ''),
    title: String(form.get('title') || ''),
    description: String(form.get('description') || ''),
  };
  await writeManifest(env, map, sha, `media: update details for ${path}`);
  return redirect(`/media?path=${encodeURIComponent(path)}`);
}

function errorPage(msg) {
  return shell('Notice', `<div class="head"><h1>Notice</h1><a class="ghost" href="/media">← Media library</a></div>
    <p class="err">${msg}</p>`);
}

async function listCollection(env, k) {
  const c = COLLECTIONS[k];
  if (!c) return redirect('/');
  const files = await ghList(env, c.dir, c.ext);
  const rows = await Promise.all(files.map(async (f) => {
    let title = f.name;
    if (c.titleField) {
      try {
        const { text } = await ghGet(env, f.path);
        const data = c.kind === 'markdown' ? parseMarkdown(text).data : parseYaml(text);
        if (data[c.titleField]) title = String(data[c.titleField]);
      } catch { /* fall back to filename */ }
    }
    return `<a class="row" href="/edit?k=${k}&path=${encodeURIComponent(f.path)}">
      <span>${esc(title)}</span><span class="row-a">Edit →</span></a>`;
  }));
  return shell(c.label, `
    <div class="head"><h1>${esc(c.label)}</h1><a class="ghost" href="/">← All sections</a></div>
    <div class="rows">${rows.join('')}</div>`);
}

async function editForm(env, k, path, notice) {
  const c = COLLECTIONS[k];
  if (!c || !path) return redirect('/');
  const { text, sha } = await ghGet(env, path);

  // Structured editors (timetable, faq): app.js renders repeatable rows from the
  // embedded JSON and writes the edited value back into #__json on submit.
  if (STRUCTURED[k]) {
    const data = parseYaml(text);
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    return shell(c.label, `
      <div class="head"><h1>${esc(c.label)}</h1><a class="ghost" href="/">← All sections</a></div>
      ${notice ? `<p class="ok">${esc(notice)}</p>` : ''}
      <form method="POST" action="/save">
        <input type="hidden" name="k" value="${esc(k)}">
        <input type="hidden" name="path" value="${esc(path)}">
        <input type="hidden" name="sha" value="${esc(sha)}">
        <input type="hidden" id="__json" name="__json">
        <div id="structured" data-editor="${esc(k)}"></div>
        <script type="application/json" id="structured-data">${json}</script>
        <div class="actions"><button class="btn" type="submit">Save &amp; publish</button>
          <a class="ghost" href="/">Cancel</a></div>
      </form>
      <script src="/app.js"></script>`);
  }

  const parsed = c.kind === 'markdown' ? parseMarkdown(text) : { data: parseYaml(text), body: null };

  // Media list + alt map, for the image fields' picker and auto-fill.
  let imgs = [], altMap = {};
  try {
    imgs = (await ghTree(env, IMG_PREFIX)).filter((p) => IMG_EXT.test(p))
      .map((p) => '/' + p.replace(/^public\//, '')).sort();
    const { map } = await readManifest(env);
    for (const [mk, mv] of Object.entries(map)) altMap['/' + mk.replace(/^public\//, '')] = mv.alt || '';
  } catch { /* picker degrades to a plain text field */ }

  const fields = renderFields(parsed.data);
  const bodyField = c.kind === 'markdown'
    ? `<label class="fl"><span class="fk">Main text (Markdown)</span>
        <textarea class="ta body" name="__body" rows="18">${esc(parsed.body)}</textarea></label>`
    : '';
  const name = path.split('/').pop();
  const datalist = `<datalist id="imglist">${imgs.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>`;
  const altJson = `<script type="application/json" id="alt-map">${JSON.stringify(altMap).replace(/</g, '\\u003c')}</script>`;
  return shell(`Edit — ${name}`, `
    <div class="head"><h1>${esc(displayTitle(c, parsed.data, name))}</h1>
      <a class="ghost" href="/c?k=${k}">← ${esc(c.label)}</a></div>
    ${notice ? `<p class="ok">${esc(notice)}</p>` : ''}
    <span id="img-base" data-base="${SITE}" hidden></span>
    ${datalist}${altJson}
    <form method="POST" action="/save">
      <input type="hidden" name="k" value="${esc(k)}">
      <input type="hidden" name="path" value="${esc(path)}">
      <input type="hidden" name="sha" value="${esc(sha)}">
      ${fields}
      ${bodyField}
      <div class="actions"><button class="btn" type="submit">Save &amp; publish</button>
        <a class="ghost" href="/c?k=${k}">Cancel</a></div>
    </form>
    <script src="/app.js"></script>`);
}

async function doSave(request, env) {
  const form = await request.formData();
  const k = String(form.get('k')); const path = String(form.get('path')); const sha = String(form.get('sha'));
  const c = COLLECTIONS[k];
  if (!c || !path) return redirect('/');

  let text;
  try {
    if (STRUCTURED[k]) {
      // Whole value arrives as JSON from app.js.
      const data = JSON.parse(String(form.get('__json') || '{}'));
      text = buildYaml(data);
    } else {
      const data = parseFields(form);
      text = c.kind === 'markdown'
        ? buildMarkdown(data, String(form.get('__body') ?? ''))
        : buildYaml(data);
    }
  } catch (e) {
    return editForm(env, k, path, `Could not save: ${e.message}`);
  }

  try {
    await ghPut(env, path, text, sha, `content: edit ${path} (via CMS)`);
  } catch (e) {
    // Most likely a stale sha (someone else saved). Reload with a message.
    return editForm(env, k, path, `Save failed: ${e.message}. The page was reloaded with the latest version — re-apply your change.`);
  }
  return editForm(env, k, path, 'Saved. The site will update in about a minute.');
}

/* ── Form fields (type-aware) ────────────────────────────────────────────── */

function renderFields(data) {
  return Object.entries(data).map(([key, val]) => {
    const label = humanize(key);
    const t = fieldType(val);
    const hidden = `<input type="hidden" name="t__${esc(key)}" value="${t}">`;
    if (t === 'boolean') {
      return `<label class="fl fl-row"><input type="checkbox" name="f__${esc(key)}" ${val ? 'checked' : ''}>
        <span class="fk">${esc(label)}</span></label>${hidden}`;
    }
    if (t === 'number') {
      return `<label class="fl"><span class="fk">${esc(label)}</span>
        <input class="in" type="number" name="f__${esc(key)}" value="${esc(String(val ?? ''))}"></label>${hidden}`;
    }
    if (t === 'yaml') {
      return `<label class="fl"><span class="fk">${esc(label)} <em>(advanced — keep the layout/indentation)</em></span>
        <textarea class="ta" name="f__${esc(key)}" rows="${Math.min(16, buildYaml(val).split('\n').length + 1)}">${esc(buildYaml(val).replace(/\n$/, ''))}</textarea></label>${hidden}`;
    }
    // string
    const s = val == null ? '' : String(val);
    // Image field: a path to an image (by key name or by value shape).
    const isImage = (/image|photo|hero|avatar/i.test(key) && !/alt/i.test(key)) ||
      /^\/images\/.*\.(webp|jpe?g|png|gif|avif|svg)$/i.test(s);
    if (isImage) {
      return `<label class="fl"><span class="fk">${esc(label)}
          <em>(pick from the media library, or paste a path)</em></span>
        <img class="img-prev" src="${s ? SITE + esc(s) : ''}" alt="" style="${s ? '' : 'display:none'}">
        <input class="in img-field" type="text" list="imglist" name="f__${esc(key)}" value="${esc(s)}" placeholder="/images/…">
        <a class="ghost imglink" href="/media" target="_blank" rel="noopener">Open media library ↗</a>
      </label>${hidden}`;
    }
    const multiline = s.length > 70 || s.includes('\n');
    const input = multiline
      ? `<textarea class="ta" name="f__${esc(key)}" rows="${Math.min(8, s.split('\n').length + 2)}">${esc(s)}</textarea>`
      : `<input class="in" type="text" name="f__${esc(key)}" value="${esc(s)}">`;
    return `<label class="fl"><span class="fk">${esc(label)}</span>${input}</label>${hidden}`;
  }).join('');
}

function parseFields(form) {
  const data = {};
  for (const [name] of form) {
    if (!name.startsWith('t__')) continue;
    const key = name.slice(3);
    const t = String(form.get(name));
    const raw = form.get(`f__${key}`);
    if (t === 'boolean') data[key] = raw != null; // checkbox present = checked
    else if (t === 'number') data[key] = raw === '' || raw == null ? null : Number(raw);
    else if (t === 'yaml') data[key] = loadYamlSnippet(String(raw ?? '')); // throws on bad YAML
    else data[key] = normalizeNewlines(String(raw ?? ''));
  }
  return data;
}

function fieldType(v) {
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'number') return 'number';
  if (v !== null && typeof v === 'object') return 'yaml'; // arrays + objects
  return 'string';
}

/* ── HTML shell ──────────────────────────────────────────────────────────── */

function loginPage(error) {
  return page('Sign in', `
    <form class="card" method="POST" action="/login" autocomplete="on">
      <h1>Website Manager</h1><p class="sub">Sign in to edit the Health Hub website.</p>
      ${error ? `<p class="err">${esc(error)}</p>` : ''}
      <label class="fl"><span class="fk">Email</span>
        <input class="in" type="email" name="email" required autocomplete="username" autofocus></label>
      <label class="fl"><span class="fk">Password</span>
        <input class="in" type="password" name="password" required autocomplete="current-password"></label>
      <button class="btn" type="submit">Sign in</button>
    </form>`);
}

function shell(title, inner) {
  return page(title, `<div class="wrap">${inner}</div>`);
}

function page(title, inner, status = 200) {
  const html = `<!doctype html><html lang="en-AU"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)} · Health Hub</title>
<style>${CSS}</style></head><body>${inner}</body></html>`;
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': 'no-store',
      'Content-Security-Policy':
        "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; " +
        "img-src 'self' data: https://healthhub-tweed-coast.clent.workers.dev https://www.healthhubtweedcoast.com.au https://healthhubtweedcoast.com.au; " +
        "form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}

function redirect(location, extra = {}) {
  return new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store', ...extra } });
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function displayTitle(c, data, name) {
  if (c.titleField && data[c.titleField]) return String(data[c.titleField]);
  return name;
}
function humanize(key) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
function normalizeNewlines(s) { return s.replace(/\r\n/g, '\n'); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const CSS = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#eef4f5;color:#22303a}
.card{background:#fff;width:min(92vw,380px);margin:12vh auto;padding:30px 28px;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.08)}
.wrap{max-width:820px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:1.4rem;margin:0}
.head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:4px}
.sub{color:#5c6b75;margin:6px 0 22px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
.tile{display:flex;flex-direction:column;gap:10px;background:#fff;border:1px solid #dbe5e8;border-radius:12px;padding:18px 20px;text-decoration:none;color:#22303a;transition:.15s}
.tile:hover{border-color:#2b8a9a;transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.06)}
.tile-t{font-weight:600;font-size:1.05rem}
.tile-a,.row-a{color:#2b8a9a;font-size:.85rem}
.rows{display:flex;flex-direction:column;border:1px solid #dbe5e8;border-radius:12px;overflow:hidden;background:#fff}
.row{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;text-decoration:none;color:#22303a;border-top:1px solid #eef2f4}
.row:first-child{border-top:0}.row:hover{background:#f5fafb}
.fl{display:block;margin:16px 0}
.fl-row{display:flex;align-items:center;gap:10px}
.fk{display:block;font-size:.82rem;font-weight:600;margin-bottom:6px;color:#3a4a54}
.fk em{font-weight:400;color:#8494a0;font-style:normal;font-size:.9em}
.in,.ta{width:100%;padding:10px 12px;border:1px solid #cdd8dc;border-radius:9px;font-size:1rem;font-family:inherit;background:#fff}
.ta{resize:vertical;line-height:1.5}
.ta.body{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.92rem}
.actions{display:flex;align-items:center;gap:16px;margin-top:26px}
.btn{background:#2b8a9a;color:#fff;border:0;border-radius:9px;padding:11px 20px;font-size:1rem;font-weight:600;cursor:pointer}
.btn:hover{background:#247685}
.ghost{color:#2b8a9a;text-decoration:none;font-size:.9rem}
.err{background:#fdecec;border:1px solid #f5b5b5;color:#a12;padding:10px 12px;border-radius:9px;font-size:.9rem}
.ok{background:#eaf7ee;border:1px solid #b6e0c2;color:#1c6b34;padding:10px 12px;border-radius:9px;font-size:.9rem}
fieldset.day,fieldset.faq-item{border:1px solid #dbe5e8;border-radius:12px;padding:8px 18px 18px;margin:16px 0;background:#fff}
fieldset.day>legend,fieldset.faq-item>legend{font-weight:600;padding:0 8px}
fieldset.day>legend{font-size:1.05rem;color:#2b8a9a}
.srow{display:grid;grid-template-columns:1.4fr 1fr 1.4fr auto;gap:10px;align-items:end;padding:10px 0;border-top:1px solid #eef2f4}
.srow:first-of-type{border-top:0}
.srow .fl{margin:0}
.add-btn{margin-top:10px;background:#eaf5f6;color:#1f6b78;border:1px dashed #9cc7ce;border-radius:9px;padding:9px 14px;font-size:.9rem;font-weight:600;cursor:pointer}
.add-btn:hover{background:#dcecef}
.rm{background:#fff;color:#a12;border:1px solid #f0c0c0;border-radius:8px;padding:9px 12px;font-size:.85rem;cursor:pointer;height:fit-content}
.rm:hover{background:#fdecec}
@media(max-width:640px){.srow{grid-template-columns:1fr}}
.upload{background:#fff;border:1px solid #dbe5e8;border-radius:12px;padding:18px 20px;margin:8px 0 22px}
.uh{font-size:1rem;margin:0 0 8px}
.urow{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:640px){.urow{grid-template-columns:1fr}}
.hint{color:#8494a0;font-size:.85rem}
.mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}
.mcard{display:flex;flex-direction:column;background:#fff;border:1px solid #dbe5e8;border-radius:10px;overflow:hidden;text-decoration:none;color:#22303a}
.mcard:hover{border-color:#2b8a9a}
.mthumb{aspect-ratio:1;background:#f0f5f6;display:flex;align-items:center;justify-content:center;overflow:hidden}
.mthumb img{width:100%;height:100%;object-fit:cover}
.mname{font-size:.72rem;padding:8px 8px 2px;word-break:break-all;color:#3a4a54}
.mmeta{font-size:.7rem;padding:0 8px 8px;color:#1c6b34}
.mmeta.warn{color:#b46a00}
.mdetail{display:grid;grid-template-columns:280px 1fr;gap:24px;align-items:start}
@media(max-width:640px){.mdetail{grid-template-columns:1fr}}
.mprev{width:100%;border:1px solid #dbe5e8;border-radius:10px;background:#f0f5f6}
.mpath{font-family:ui-monospace,Menlo,monospace;font-size:.8rem;color:#5c6b75;margin:0 0 8px;word-break:break-all}
.img-prev{display:block;max-width:220px;max-height:150px;border:1px solid #dbe5e8;border-radius:8px;margin:0 0 8px;background:#f0f5f6}
.img-field{margin-bottom:4px}
.imglink{display:inline-block;margin-top:2px;font-size:.82rem}
`;
