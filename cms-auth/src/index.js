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
  ghCommits, ghGetAtRef,
} from './lib.js';
import { APP_JS } from './app-js.js';
import { groupedKeys, labelFor, hintFor, previewPath } from './fields.js';

// Where images live in the repo and how the CMS shows thumbnails (the live site).
const IMG_PREFIX = 'public/images/';
const SITE = 'https://healthhub-tweed-coast.clent.workers.dev';
const IMG_EXT = /\.(webp|jpe?g|png|gif|avif|svg)$/i;
const MAX_UPLOAD = 8 * 1024 * 1024; // 8 MB

// Collections edited with a structured (repeatable-row) editor instead of the
// generic field form. Their whole value is submitted as JSON by app.js.
const STRUCTURED = { timetable: true, faq: true };

// Fields shown as friendly add/remove-row editors (app.js builds the UI and
// submits them as JSON) instead of a raw-YAML box.
const FRIENDLY_FIELDS = new Set(['sessions', 'feeGroups', 'coTeachers']);
// Friendly fields to ALWAYS show for a collection, even when the entry has none
// yet — so an editor can add class times, fees or a co-teacher to any entry.
const ALWAYS_SHOW = {
  events: ['sessions', 'feeGroups', 'coTeachers'],
  practitioners: ['feeGroups'],
};
// Collections an editor can create new entries in, with the wording for the form.
const CREATABLE = {
  practitioners: { titleField: 'name', titleLabel: 'Full name', noun: 'practitioner' },
  events: { titleField: 'title', titleLabel: 'Class / event name', noun: 'class or event' },
};

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
  if (p === '/new' && url.searchParams.get('k')) return newEntryForm(url.searchParams.get('k'));
  if (p === '/create' && request.method === 'POST') return doCreate(request, env);
  if (p === '/edit') return editForm(env, url.searchParams.get('k'), url.searchParams.get('path'));
  if (p === '/save' && request.method === 'POST') return doSave(request, env);
  if (p === '/media') return mediaPage(env, url.searchParams.get('path'));
  if (p === '/media/upload' && request.method === 'POST') return doUpload(request, env);
  if (p === '/media/save' && request.method === 'POST') return doMediaSave(request, env);
  if (p === '/history') return historyPage(env, url.searchParams.get('k'), url.searchParams.get('path'));
  if (p === '/restore' && request.method === 'POST') return doRestore(request, env);
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
    <div class="head"><h1>What would you like to edit?</h1></div>
    <p class="sub">Pick a section. Changes go live a minute or so after you save.</p>
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

/* ── Version history ─────────────────────────────────────────────────────── */

async function historyPage(env, k, path, notice) {
  const c = COLLECTIONS[k];
  if (!c || !path) return redirect('/');
  const commits = await ghCommits(env, path);
  const back = `/edit?k=${k}&path=${encodeURIComponent(path)}`;
  const rows = commits.map((cm, i) => {
    const when = new Date(cm.date).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
    const who = cm.message.includes('via CMS') ? 'edited here' : 'change';
    return `<div class="vrow">
      <span><strong>${esc(when)}</strong><span class="vmeta">${i === 0 ? 'current version' : esc(who)}</span></span>
      ${i === 0 ? '<span class="vmeta">—</span>' : `<form method="POST" action="/restore" onsubmit="return confirm('Restore this version? Your current version is saved first, so you can undo.')">
        <input type="hidden" name="k" value="${esc(k)}"><input type="hidden" name="path" value="${esc(path)}">
        <input type="hidden" name="sha" value="${esc(cm.sha)}">
        <button class="btn small" type="submit">Restore this</button></form>`}</div>`;
  }).join('');
  return shell('Version history', `
    <div class="head"><h1>Version history</h1><a class="ghost" href="${back}">← Back to editing</a></div>
    ${notice ? `<p class="ok">${esc(notice)}</p>` : ''}
    <p class="sub">Every save is kept. Restore any earlier version — your current one is saved first, so you can always undo.</p>
    <div class="vlist">${rows || '<p class="sub">No history yet.</p>'}</div>`);
}

async function doRestore(request, env) {
  const form = await request.formData();
  const k = String(form.get('k')); const path = String(form.get('path')); const oldSha = String(form.get('sha'));
  if (!COLLECTIONS[k] || !path || !oldSha) return redirect('/');
  const old = await ghGetAtRef(env, path, oldSha);
  const current = await ghGet(env, path); // for its sha
  await ghPut(env, path, old.text, current.sha, `content: restore ${path} to an earlier version (via CMS)`);
  return editForm(env, k, path, 'Restored an earlier version. The site will update in about a minute.');
}

async function listCollection(env, k) {
  const c = COLLECTIONS[k];
  if (!c) return redirect('/');
  const files = await ghList(env, c.dir, c.ext);
  const rows = await Promise.all(files.map(async (f) => {
    let title = c === COLLECTIONS.pages ? pageTitle(f.name) : f.name;
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
    <div class="head"><h1>${esc(c.label)}</h1>
      <span class="headlinks">
        ${CREATABLE[k] ? `<a class="btn" href="/new?k=${k}">+ Add new</a>` : ''}
        <a class="ghost" href="/">← All sections</a></span></div>
    <div class="rows">${rows.join('')}</div>`);
}

/* ── Create a new entry ──────────────────────────────────────────────────── */

function newEntryForm(k, notice) {
  const c = COLLECTIONS[k]; const cr = CREATABLE[k];
  if (!c || !cr) return redirect('/');
  return shell(`New ${c.label}`, `
    <div class="head"><h1>Add a new ${esc(cr.noun)}</h1>
      <a class="ghost" href="/c?k=${k}">← ${esc(c.label)}</a></div>
    ${notice ? `<p class="err wrap-msg">${esc(notice)}</p>` : ''}
    <form method="POST" action="/create" class="narrow-form">
      <input type="hidden" name="k" value="${esc(k)}">
      <label class="fl"><span class="fk">${esc(cr.titleLabel)}</span>
        <input class="in" name="title" required autofocus></label>
      <p class="hint">It starts hidden, so you can fill in the details before it goes live.
        After you create it you'll go straight to the editor.</p>
      <div class="actions"><button class="btn" type="submit">Create &amp; edit →</button>
        <a class="ghost" href="/c?k=${k}">Cancel</a></div>
    </form>`);
}

function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/['’]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled';
}

/** Schema-valid starting frontmatter for a new entry (hidden until published). */
function newEntryData(k, title) {
  // Empty strings are fine — optionalText/optionalUrl coerce them to undefined.
  // Listing every editable field means it shows up (blank) in the editor.
  if (k === 'practitioners') {
    return {
      name: title, role: 'Practitioner', order: 99, active: false,
      image: '', bookingUrl: '', phone: '', service: '',
      facebook: '', instagram: '', website: '', feeGroups: [],
    };
  }
  // events
  return {
    title, order: 99, category: 'other', schedule: '', summary: title, image: '',
    instructor: '', instructorPhone: '', price: '', bookingUrl: '',
    location: 'Health Hub Tweed Coast, Hastings Point',
    active: false, sessions: [], feeGroups: [], coTeachers: [],
  };
}

async function doCreate(request, env) {
  const form = await request.formData();
  const k = String(form.get('k'));
  const c = COLLECTIONS[k]; const cr = CREATABLE[k];
  if (!c || !cr) return redirect('/');
  const title = String(form.get('title') || '').trim();
  if (!title) return newEntryForm(k, 'Please enter a name.');

  // Pick a unique slug (append -2, -3… if the file already exists).
  const base = slugify(title);
  let slug = base, n = 2, path;
  while (true) {
    path = `${c.dir}/${slug}${c.ext}`;
    if (!(await ghGetOrNull(env, path))) break;
    slug = `${base}-${n++}`;
  }
  const bodyStart = k === 'practitioners' ? `### ${title}\n\nWrite the bio here.\n` : `### ${title}\n\nWrite the description here.\n`;
  const text = buildMarkdown(newEntryData(k, title), bodyStart);
  try {
    await ghPut(env, path, text, undefined, `content: create ${path} (via CMS)`);
  } catch (e) {
    return newEntryForm(k, `Could not create: ${e.message}`);
  }
  return redirect(`/edit?k=${k}&path=${encodeURIComponent(path)}`);
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
      <div class="head"><h1>${esc(c.label)}</h1>
        <span class="headlinks">
          <a class="ghost" href="${esc(SITE + previewPath(k, path.split('/').pop()))}" target="_blank" rel="noopener">View live ↗</a>
          <a class="ghost" href="/history?k=${k}&path=${encodeURIComponent(path)}">Version history</a>
          <a class="ghost" href="/">← All sections</a></span></div>
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

  const fields = renderFields(k, parsed.data);
  const bodyField = c.kind === 'markdown'
    ? `<label class="fl"><span class="fk">Main text (Markdown)</span>
        <textarea class="ta body" name="__body" rows="18">${esc(parsed.body)}</textarea></label>`
    : '';
  const name = path.split('/').pop();
  const datalist = `<datalist id="imglist">${imgs.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>`;
  const altJson = `<script type="application/json" id="alt-map">${JSON.stringify(altMap).replace(/</g, '\\u003c')}</script>`;
  const live = SITE + previewPath(k, name);
  const previewSrc = live + (live.includes('?') ? '&' : '?') + 'cms-preview=1';
  return page(`Edit — ${name}`, `
    ${topbarHtml()}
    <div class="editbar">
      <span class="eb-title">${esc(displayTitle(c, parsed.data, name))}</span>
      <a class="ghost" href="/c?k=${k}">← ${esc(c.label)}</a>
      <a class="ghost" href="/history?k=${k}&path=${encodeURIComponent(path)}">Version history</a>
      <a class="ghost" href="${esc(live)}" target="_blank" rel="noopener">View live ↗</a>
      <span class="eb-spacer"></span>
      <span id="save-status" class="save-status"></span>
      <button class="btn" type="submit" form="editform">Save &amp; publish</button>
    </div>
    ${notice ? `<p class="ok wrap-msg">${esc(notice)}</p>` : ''}
    <span id="img-base" data-base="${SITE}" hidden></span>
    ${datalist}${altJson}
    <div class="twopane" data-preview-origin="${SITE}">
      <div class="pane-fields">
        <form id="editform" method="POST" action="/save">
          <input type="hidden" name="k" value="${esc(k)}">
          <input type="hidden" name="path" value="${esc(path)}">
          <input type="hidden" name="sha" value="${esc(sha)}">
          ${fields}
          ${bodyField}
        </form>
      </div>
      <div class="pane-preview">
        <div class="pv-toolbar"><span class="pv-badge">Live preview</span>
          <button type="button" class="ghost" id="pv-reload">↻ Refresh</button></div>
        <iframe id="pv" src="${esc(previewSrc)}" title="Live preview" referrerpolicy="no-referrer"></iframe>
      </div>
    </div>
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
      // Pages re-nest their dotted keys (hero.heading → hero: { heading }).
      const data = k === 'pages' ? unflatten(parseFields(form)) : parseFields(form);
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

function renderFields(collection, data) {
  // Pages like home.yml are nested (hero: {...}, welcome: {...}). Expand each
  // nested section into friendly labelled fields grouped under a section header,
  // using dotted names (hero.heading) that doSave() re-nests. Scalars and arrays
  // stay in the normal grouped flow. Other collections are unaffected.
  if (collection === 'pages') {
    const scalars = {}, sections = [];
    for (const [key, val] of Object.entries(data)) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val)) sections.push([key, val]);
      else scalars[key] = val;
    }
    let html = groupedKeys(collection, scalars).map((g) => {
      const inner = g.keys.map((key) => renderOneField(collection, key, scalars[key])).join('');
      return `<div class="group">${g.title ? `<div class="gh">${esc(g.title)}</div>` : ''}${inner}</div>`;
    }).join('');
    for (const [section, obj] of sections) {
      const inner = Object.entries(obj)
        .map(([ck, cv]) => renderOneField(collection, `${section}.${ck}`, cv, humanize(ck)))
        .join('');
      html += `<div class="group"><div class="gh">${esc(humanize(section))}</div>${inner}</div>`;
    }
    return html;
  }
  // Always surface the friendly list editors (class times, fees, co-teachers)
  // for this collection, even when the entry has none yet, so they can be added.
  const data2 = { ...data };
  for (const key of (ALWAYS_SHOW[collection] || [])) if (!(key in data2)) data2[key] = [];
  return groupedKeys(collection, data2).map((g) => {
    const inner = g.keys.map((key) => renderOneField(collection, key, data2[key])).join('');
    return `<div class="group">${g.title ? `<div class="gh">${esc(g.title)}</div>` : ''}${inner}</div>`;
  }).join('');
}

/** Friendly add/remove-row editor for a list field (class times, fees, …).
 *  app.js builds the rows from the seed JSON and writes the edited value back
 *  into the hidden input as JSON on submit; parseFields reads it as t=json. */
function renderRepeat(key, val, label, hint) {
  const seed = JSON.stringify(Array.isArray(val) ? val : []).replace(/</g, '\\u003c');
  return `<div class="fl fl-block">
    <span class="fk">${esc(label)}</span>
    ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
    <div class="repeat" data-kind="${esc(key)}">
      <div class="repeat-rows"></div>
      <button type="button" class="add-btn repeat-add">+ Add</button>
      <script type="application/json" class="repeat-seed">${seed}</script>
    </div>
    ${/* Pre-seeded with the current value so a JS failure can't wipe it on save;
         app.js overwrites this on submit with the edited value. */ ''}
    <input type="hidden" name="f__${esc(key)}" value="${esc(seed)}">
    <input type="hidden" name="t__${esc(key)}" value="json">
  </div>`;
}

function renderOneField(collection, key, val, labelOverride) {
  const label = labelOverride || labelFor(collection, key, humanize(key));
  const hint = hintFor(collection, key);
  const hintHtml = hint ? `<span class="hint">${esc(hint)}</span>` : '';
  // Class times / fees / co-teachers get a friendly add/remove-row editor.
  if (FRIENDLY_FIELDS.has(key)) return renderRepeat(key, val, label, hint);
  const t = fieldType(val);
  const hidden = `<input type="hidden" name="t__${esc(key)}" value="${t}">`;
  if (t === 'boolean') {
    return `<label class="fl fl-row"><input type="checkbox" name="f__${esc(key)}" ${val ? 'checked' : ''}>
      <span class="fk">${esc(label)}</span></label>${hintHtml}${hidden}`;
  }
  if (t === 'number') {
    return `<label class="fl"><span class="fk">${esc(label)}</span>
      <input class="in" type="number" name="f__${esc(key)}" value="${esc(String(val ?? ''))}">${hintHtml}</label>${hidden}`;
  }
  if (t === 'yaml') {
    const y = buildYaml(val).replace(/\n$/, '');
    return `<label class="fl"><span class="fk">${esc(label)} <em>(advanced — keep the layout)</em></span>
      <textarea class="ta mono" name="f__${esc(key)}" rows="${Math.min(16, y.split('\n').length + 1)}">${esc(y)}</textarea>${hintHtml}</label>${hidden}`;
  }
  const s = val == null ? '' : String(val);
  // Match on the leaf segment so a section named "hero" (hero.heading) is not
  // mistaken for an image field; a real /images/… value is always treated as one.
  const leaf = key.split('.').pop();
  const isImage = (/image|photo|hero|avatar/i.test(leaf) && !/alt/i.test(leaf)) ||
    /^\/images\/.*\.(webp|jpe?g|png|gif|avif|svg)$/i.test(s);
  if (isImage) {
    return `<label class="fl"><span class="fk">${esc(label)}</span>
      <img class="img-prev" src="${s ? SITE + esc(s) : ''}" alt="" style="${s ? '' : 'display:none'}">
      <input class="in img-field" type="text" list="imglist" name="f__${esc(key)}" value="${esc(s)}" placeholder="/images/…">
      <a class="ghost imglink" href="/media" target="_blank" rel="noopener">Open media library ↗</a>
      ${hintHtml}</label>${hidden}`;
  }
  const multiline = s.length > 70 || s.includes('\n');
  const input = multiline
    ? `<textarea class="ta" name="f__${esc(key)}" rows="${Math.min(8, s.split('\n').length + 2)}">${esc(s)}</textarea>`
    : `<input class="in" type="text" name="f__${esc(key)}" value="${esc(s)}">`;
  return `<label class="fl"><span class="fk">${esc(label)}</span>${input}${hintHtml}</label>${hidden}`;
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
    else if (t === 'json') {
      // Friendly list editors (class times, fees, co-teachers). Omit the key
      // entirely when the list is empty so the frontmatter stays clean.
      const v = JSON.parse(String(raw || 'null'));
      if (Array.isArray(v) ? v.length : v != null) data[key] = v;
    }
    else data[key] = normalizeNewlines(String(raw ?? ''));
  }
  return data;
}

/** Rebuild nested objects from dotted field names, preserving key order.
 *  { 'hero.heading': 'x', metaTitle: 'y' } → { hero: { heading: 'x' }, metaTitle: 'y' } */
function unflatten(flat) {
  const out = {};
  for (const [k, v] of Object.entries(flat)) {
    if (!k.includes('.')) { out[k] = v; continue; }
    const parts = k.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = v;
  }
  return out;
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

function topbarHtml() {
  return `<div class="topbar">
    <a class="brand" href="/"><img src="${SITE}/images/logo.png" alt="Health Hub" height="34"><span>Website Manager</span></a>
    <a class="ghost" href="/logout">Sign out</a></div>`;
}
function shell(title, inner) {
  return page(title, `${topbarHtml()}<div class="wrap">${inner}</div>`);
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
        `frame-src ${SITE} https://www.healthhubtweedcoast.com.au; ` +
        "form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}

function redirect(location, extra = {}) {
  return new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store', ...extra } });
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

// Friendly names for the site's fixed pages, so the "Page text" list and the
// editor header read "Home page" rather than the raw "home.yml" filename.
const PAGE_TITLES = {
  home: 'Home page', blog: 'Blog page', booking: 'Booking page',
  contact: 'Contact page', events: 'Events page', faq: 'FAQ page',
  practitioners: 'Practitioners page',
};
function pageTitle(name) {
  const slug = name.replace(/\.[^.]+$/, '');
  return PAGE_TITLES[slug] || humanize(slug);
}
function displayTitle(c, data, name) {
  if (c.titleField && data[c.titleField]) return String(data[c.titleField]);
  if (c === COLLECTIONS.pages) return pageTitle(name);
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
.wrap{max-width:860px;margin:0 auto;padding:24px 20px 80px}
.topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px 22px;background:#fff;border-bottom:1px solid #dce6eb}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none}
.brand img{display:block}
.brand span{font-weight:700;font-size:14px;color:#22496c}
h1{font-size:1.4rem;margin:0}
.head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:4px}
.sub{color:#5c6b75;margin:6px 0 22px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
.tile{display:flex;flex-direction:column;gap:10px;background:#fff;border:1px solid #dbe5e8;border-radius:12px;padding:18px 20px;text-decoration:none;color:#22303a;transition:.15s}
.tile:hover{border-color:#34719f;transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.06)}
.tile-t{font-weight:600;font-size:1.05rem}
.tile-a,.row-a{color:#34719f;font-size:.85rem}
.rows{display:flex;flex-direction:column;border:1px solid #dbe5e8;border-radius:12px;overflow:hidden;background:#fff}
.row{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;text-decoration:none;color:#22303a;border-top:1px solid #eef2f4}
.row:first-child{border-top:0}.row:hover{background:#f5fafb}
.fl{display:block;margin:16px 0}
.fl-row{display:flex;align-items:center;gap:10px}
.fk{display:block;font-size:.82rem;font-weight:600;margin-bottom:6px;color:#3a4a54}
.fk em{font-weight:400;color:#8494a0;font-style:normal;font-size:.9em}
.in,.ta{width:100%;padding:10px 12px;border:1px solid #cdd8dc;border-radius:9px;font-size:1rem;font-family:inherit;background:#fff}
.ta{resize:vertical;line-height:1.5}
.ta.mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9rem}
.group{background:#fff;border:1px solid #dce6eb;border-radius:12px;padding:20px 22px 8px;margin:0 0 16px}
.gh{font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:#1f7a80;margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid #eef3f5}
.hint{display:block;font-size:11.5px;color:#8494a0;margin-top:5px}
.headlinks{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.btn.small{padding:7px 13px;font-size:.85rem}
.vlist{display:flex;flex-direction:column;border:1px solid #dce6eb;border-radius:12px;overflow:hidden;background:#fff}
.vrow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 18px;border-top:1px solid #eef3f5}
.vrow:first-child{border-top:0}
.vrow strong{font-size:14px}
.vmeta{color:#8494a0;font-size:12px;margin-left:10px}
.vrow form{margin:0}
.editbar{position:sticky;top:57px;z-index:15;display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:11px 22px;background:#f5fafb;border-bottom:1px solid #dce6eb}
.eb-title{font-weight:700;color:#22496c;font-size:15px}
.eb-spacer{flex:1}
.save-status{font-size:12px;color:#8494a0}
.wrap-msg{max-width:860px;margin:12px auto 0;padding-inline:20px}
.twopane{display:grid;grid-template-columns:minmax(360px,460px) 1fr;height:calc(100vh - 110px)}
@media(max-width:900px){.twopane{grid-template-columns:1fr;height:auto}}
.pane-fields{overflow-y:auto;padding:20px;border-right:1px solid #dce6eb;background:#eef4f5}
.pane-preview{position:relative;display:flex;flex-direction:column;background:#fff;min-height:60vh}
.pv-toolbar{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #dce6eb;background:#fff}
.pv-badge{font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#1f7a80}
.pane-preview iframe{flex:1;width:100%;border:0}
@media(max-width:900px){.pane-preview{height:70vh}}
.ta.body{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.92rem}
.actions{display:flex;align-items:center;gap:16px;margin-top:26px}
.btn{background:#34719f;color:#fff;border:0;border-radius:9px;padding:11px 20px;font-size:1rem;font-weight:600;cursor:pointer}
.btn:hover{background:#22496c}
.ghost{color:#34719f;text-decoration:none;font-size:.9rem}
.err{background:#fdecec;border:1px solid #f5b5b5;color:#a12;padding:10px 12px;border-radius:9px;font-size:.9rem}
.ok{background:#eaf7ee;border:1px solid #b6e0c2;color:#1c6b34;padding:10px 12px;border-radius:9px;font-size:.9rem}
fieldset.day,fieldset.faq-item{border:1px solid #dbe5e8;border-radius:12px;padding:8px 18px 18px;margin:16px 0;background:#fff}
fieldset.day>legend,fieldset.faq-item>legend{font-weight:600;padding:0 8px}
fieldset.day>legend{font-size:1.05rem;color:#34719f}
.srow{display:grid;grid-template-columns:1.4fr 1fr 1.4fr auto;gap:10px;align-items:end;padding:10px 0;border-top:1px solid #eef2f4}
.srow:first-of-type{border-top:0}
.srow .fl{margin:0}
.add-btn{margin-top:10px;background:#eaf5f6;color:#1f7a80;border:1px dashed #9cc7ce;border-radius:9px;padding:9px 14px;font-size:.9rem;font-weight:600;cursor:pointer}
.add-btn:hover{background:#dcecef}
.rm{background:#fff;color:#a12;border:1px solid #f0c0c0;border-radius:8px;padding:9px 12px;font-size:.85rem;cursor:pointer;height:fit-content}
.rm:hover{background:#fdecec}
@media(max-width:640px){.srow{grid-template-columns:1fr}}
/* Friendly list editors (class times, fees, co-teachers) */
.fl-block{display:block}
.narrow-form{max-width:560px}
.repeat{margin-top:8px}
.repeat-rows{display:flex;flex-direction:column;gap:12px}
.rrow{display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:10px;align-items:end;background:#fff;border:1px solid #dbe5e8;border-radius:11px;padding:14px}
.rrow .fl{margin:0}
.srow3{grid-template-columns:1.1fr .8fr .8fr 1.4fr auto}
.fee-group{grid-template-columns:1fr;gap:12px}
.fee-items-wrap{border-top:1px solid #eef2f4;padding-top:10px}
.fk.sub{font-size:.78rem;color:#5b6b76;display:block;margin-bottom:6px}
.fee-items{display:flex;flex-direction:column;gap:8px}
.item-row{display:grid;grid-template-columns:1fr .5fr auto;gap:8px;align-items:center}
.rm-item{background:#fff;color:#a12;border:1px solid #f0c0c0;border-radius:8px;width:34px;height:34px;font-size:1rem;line-height:1;cursor:pointer}
.rm-item:hover{background:#fdecec}
@media(max-width:640px){.rrow,.srow3{grid-template-columns:1fr}}
.upload{background:#fff;border:1px solid #dbe5e8;border-radius:12px;padding:18px 20px;margin:8px 0 22px}
.uh{font-size:1rem;margin:0 0 8px}
.urow{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:640px){.urow{grid-template-columns:1fr}}
.hint{color:#8494a0;font-size:.85rem}
.mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}
.mcard{display:flex;flex-direction:column;background:#fff;border:1px solid #dbe5e8;border-radius:10px;overflow:hidden;text-decoration:none;color:#22303a}
.mcard:hover{border-color:#34719f}
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
