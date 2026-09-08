/**
 * Client-side JavaScript for the CMS, served at /app.js.
 * Handles the repeatable Timetable/FAQ editors and the image picker.
 * Served from the worker's own origin, so the CSP stays `script-src 'self'`.
 */
export const APP_JS = String.raw`
(function () {
  'use strict';

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'value') n.value = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function field(labelText, node) {
    return el('label', { class: 'fl' }, [el('span', { class: 'fk' }, [labelText]), node]);
  }
  function input(cls, val) { return el('input', { class: 'in ' + cls, value: val == null ? '' : String(val) }); }
  function textarea(cls, val, rows) {
    var t = el('textarea', { class: 'ta ' + cls, rows: rows || 3 }); t.value = val == null ? '' : String(val); return t;
  }
  function btn(cls, txt) { var b = el('button', { class: cls, type: 'button' }, [txt]); return b; }

  /* ── Timetable editor ─────────────────────────────────────────────────── */
  function linkSelect(val, opts) {
    var sel = el('select', { class: 'in s-href' });
    sel.appendChild(el('option', { value: '' }, ['— No link —']));
    var found = false;
    (opts || []).forEach(function (o) {
      var op = el('option', { value: o.href }, [o.label]);
      if (o.href === val) { op.selected = true; found = true; }
      sel.appendChild(op);
    });
    if (val && !found) {
      var custom = el('option', { value: val }, [val + ' (current)']);
      custom.selected = true;
      sel.appendChild(custom);
    }
    return sel;
  }
  function sessionRow(s, opts) {
    s = s || {};
    var wrap = el('div', { class: 'srow' }, [
      field('Class / session', input('s-name', s.name)),
      field('Time (as shown)', input('s-time', s.time)),
      field('Links to', linkSelect(s.href, opts)),
      btn('rm', 'Remove'),
    ]);
    return wrap;
  }
  function initTimetable(root, data, opts) {
    var days = (data.days || []);
    var host = el('div', {});
    days.forEach(function (d) {
      var sessWrap = el('div', { class: 'sessions' }, (d.sessions || []).map(function (s) { return sessionRow(s, opts); }));
      var add = btn('add-btn', '+ Add a class to ' + d.day);
      add.addEventListener('click', function () { sessWrap.appendChild(sessionRow({}, opts)); });
      host.appendChild(el('fieldset', { class: 'day', 'data-day': d.day }, [
        el('legend', {}, [d.day]), sessWrap, add,
      ]));
    });
    root.appendChild(field('Note shown under the timetable', textarea('tt-note', data.note, 3)));
    root.appendChild(host);
    root.addEventListener('click', function (e) {
      if (e.target.classList.contains('rm')) { var r = e.target.closest('.srow'); if (r) r.remove(); }
    });
    return function serialize() {
      var out = { days: [] };
      var note = root.querySelector('.tt-note').value.trim();
      if (note) out.note = note;
      host.querySelectorAll('fieldset.day').forEach(function (fs) {
        var sessions = [];
        fs.querySelectorAll('.srow').forEach(function (r) {
          var name = r.querySelector('.s-name').value.trim();
          var time = r.querySelector('.s-time').value.trim();
          var href = r.querySelector('.s-href').value.trim();
          if (!name && !time) return;
          var o = { name: name, time: time }; if (href) o.href = href;
          sessions.push(o);
        });
        out.days.push({ day: fs.getAttribute('data-day'), sessions: sessions });
      });
      return out;
    };
  }

  /* ── FAQ editor ───────────────────────────────────────────────────────── */
  function faqItem(it) {
    it = it || {};
    return el('fieldset', { class: 'faq-item' }, [
      field('Question', input('f-q', it.q)),
      field('Answer', textarea('f-a', it.a, 5)),
      field('Anchor id (for #links — change carefully)', input('f-id', it.id)),
      btn('rm', 'Remove this question'),
    ]);
  }
  function initFaq(root, data) {
    var list = el('div', {}, (data.items || []).map(faqItem));
    var add = btn('add-btn', '+ Add a question');
    add.addEventListener('click', function () { list.appendChild(faqItem({})); });
    root.appendChild(list);
    root.appendChild(add);
    root.appendChild(field('Disclaimer (shown once under the list)', textarea('faq-disc', data.disclaimer, 3)));
    root.addEventListener('click', function (e) {
      if (e.target.classList.contains('rm')) { var r = e.target.closest('.faq-item'); if (r) r.remove(); }
    });
    return function serialize() {
      var out = { items: [] };
      list.querySelectorAll('.faq-item').forEach(function (fs) {
        var q = fs.querySelector('.f-q').value.trim();
        var a = fs.querySelector('.f-a').value.trim();
        var id = fs.querySelector('.f-id').value.trim();
        if (!q && !a) return;
        out.items.push({ q: q, a: a, id: id });
      });
      var disc = root.querySelector('.faq-disc').value.trim();
      if (disc) out.disclaimer = disc;
      return out;
    };
  }

  /* ── Image field: upload-in-place (WordPress-style), preview, remove ────── */
  function initImagePickers() {
    var baseEl = document.getElementById('img-base');
    var base = baseEl ? baseEl.getAttribute('data-base') : '';
    var altMap = {};
    try { altMap = JSON.parse(document.getElementById('alt-map').textContent); } catch (e) {}

    document.querySelectorAll('.imgwrap').forEach(function (wrap) {
      var field = wrap.querySelector('.img-field');   // hidden value (name=f__…)
      var prev = wrap.querySelector('.img-prev');
      var fileInp = wrap.querySelector('.img-file');
      var uploadBtn = wrap.querySelector('.img-upload');
      var clearBtn = wrap.querySelector('.img-clear');
      var pathInp = wrap.querySelector('.img-path');
      var status = wrap.querySelector('.img-status');
      if (!field) return;

      // If a chosen image isn't deployed yet, show it from the repo via the worker.
      if (prev) prev.addEventListener('error', function () {
        var v = field.value.trim();
        if (!v || prev.dataset.fb) return; prev.dataset.fb = '1';
        prev.src = '/media/file?path=' + encodeURIComponent(v);
      });

      // Apply a value everywhere: preview, buttons, advanced field, live preview,
      // and auto-fill a blank alt from the media library's saved alt text.
      function apply(v, opts) {
        v = (v || '').trim();
        opts = opts || {};
        field.value = v;
        if (pathInp && opts.setPath !== false) pathInp.value = v;
        // opts.previewSrc lets a just-picked file show instantly (a local object
        // URL) even though its live URL won't exist until the site redeploys.
        if (prev) {
          prev.dataset.fb = ''; // let the new value try its live URL before falling back
          prev.src = opts.previewSrc || (v ? base + v : '');
          prev.style.display = (v || opts.previewSrc) ? '' : 'none';
        }
        if (uploadBtn) uploadBtn.textContent = v ? 'Change image' : 'Upload image';
        if (clearBtn) clearBtn.hidden = !v;
        var form = field.closest('form');
        var alt = form && form.querySelector('input[name*="alt" i], textarea[name*="alt" i]');
        if (alt && !alt.value.trim() && altMap[v]) alt.value = altMap[v];
        // Nudge the live preview (initLivePreview listens for input on the form).
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (uploadBtn && fileInp) {
        uploadBtn.addEventListener('click', function () { fileInp.click(); });
        fileInp.addEventListener('change', function () {
          var f = fileInp.files && fileInp.files[0];
          if (!f) return;
          // Instant local preview of the exact file the user picked.
          var localUrl = '';
          try { localUrl = URL.createObjectURL(f); } catch (e) {}
          if (localUrl && prev) { prev.src = localUrl; prev.style.display = ''; }
          if (status) { status.textContent = 'Uploading…'; status.className = 'img-status busy'; }
          if (uploadBtn) uploadBtn.disabled = true;
          var fd = new FormData();
          fd.append('file', f);
          fetch('/media/upload-inline', { method: 'POST', body: fd })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
              if (res.ok && res.j && res.j.ok) {
                apply(res.j.path, { previewSrc: localUrl });
                if (status) { status.textContent = 'Uploaded ✓ — Save to publish'; status.className = 'img-status ok'; }
              } else {
                if (status) { status.textContent = (res.j && res.j.error) || 'Upload failed.'; status.className = 'img-status err'; }
              }
            })
            .catch(function () { if (status) { status.textContent = 'Upload failed — check your connection.'; status.className = 'img-status err'; } })
            .then(function () { if (uploadBtn) uploadBtn.disabled = false; fileInp.value = ''; });
        });
      }
      if (clearBtn) clearBtn.addEventListener('click', function () {
        apply(''); if (status) { status.textContent = ''; status.className = 'img-status'; }
      });
      if (pathInp) {
        pathInp.addEventListener('input', function () { apply(pathInp.value, { setPath: false }); });
        pathInp.addEventListener('change', function () { apply(pathInp.value, { setPath: false }); });
      }
      var libBtn = wrap.querySelector('.img-library');
      if (libBtn) libBtn.addEventListener('click', function () {
        openMediaLibrary(base, field.value, function (path) {
          apply(path);
          if (status) { status.textContent = 'Selected — Save to publish'; status.className = 'img-status ok'; }
        });
      });
    });
  }

  /* ── Media library modal: pick an existing image or upload a new one ─────── */
  var mediaLib = null; // built once, reused

  function loadMediaItems() {
    try { return JSON.parse(document.getElementById('media-lib').textContent) || []; }
    catch (e) { return []; }
  }

  function buildMediaLib() {
    var overlay = el('div', { class: 'mlib-overlay', role: 'dialog', 'aria-modal': 'true', hidden: '' });
    var box = el('div', { class: 'mlib' });
    var head = el('div', { class: 'mlib-head' }, [
      el('strong', {}, ['Media library']),
      el('input', { class: 'in mlib-search', type: 'search', placeholder: 'Search images…' }),
      el('button', { type: 'button', class: 'btn-sm mlib-upload' }, ['Upload new']),
      el('button', { type: 'button', class: 'ghost mlib-close', 'aria-label': 'Close' }, ['✕']),
    ]);
    var grid = el('div', { class: 'mlib-grid' });
    var empty = el('p', { class: 'mlib-empty', hidden: '' }, ['No images match.']);
    var status = el('span', { class: 'mlib-status' });
    var fileInp = el('input', { type: 'file', class: 'mlib-file', accept: 'image/*', hidden: '' });
    head.appendChild(status);
    box.appendChild(head); box.appendChild(grid); box.appendChild(empty); box.appendChild(fileInp);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var state = { base: '', onPick: null, current: '' };

    function close() { overlay.hidden = true; }
    function pick(path) { if (state.onPick) state.onPick(path); close(); }

    function render(filter) {
      grid.textContent = '';
      var items = loadMediaItems();
      var q = (filter || '').toLowerCase();
      var shown = 0;
      items.forEach(function (it) {
        var hay = (it.path + ' ' + (it.alt || '')).toLowerCase();
        if (q && hay.indexOf(q) === -1) return;
        shown++;
        var name = it.path.split('/').pop();
        // A div (not a button) so it can hold the delete button; click selects.
        var cell = el('div', { class: 'mlib-cell' + (it.path === state.current ? ' sel' : ''), title: name, tabindex: '0', role: 'button' });
        var img = el('img', { loading: 'lazy', alt: it.alt || '' });
        // Just-uploaded images aren't on the live site yet — fall back to the
        // worker, which serves the bytes straight from the repo.
        img.addEventListener('error', function () {
          if (img.dataset.fb) return; img.dataset.fb = '1';
          img.src = '/media/file?path=' + encodeURIComponent(it.path);
        });
        img.src = state.base + it.path;
        var del = el('button', { type: 'button', class: 'mlib-del', title: 'Delete image', 'aria-label': 'Delete ' + name }, ['🗑']);
        del.addEventListener('click', function (e) { e.stopPropagation(); deleteItem(it, cell); });
        cell.appendChild(del);
        cell.appendChild(img);
        cell.appendChild(el('span', { class: 'mlib-name' }, [name]));
        cell.addEventListener('click', function () { pick(it.path); });
        cell.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(it.path); } });
        grid.appendChild(cell);
      });
      empty.hidden = shown > 0;
    }

    function deleteItem(it, cell) {
      var nm = it.path.split('/').pop();
      if (!window.confirm('Delete "' + nm + '" from the library?\n\nThis can’t be undone, and any page still using this image will lose it.')) return;
      status.textContent = 'Deleting…'; status.className = 'mlib-status busy';
      var fd = new FormData(); fd.append('path', it.path);
      fetch('/media/delete', { method: 'POST', body: fd })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j && res.j.ok) {
            try {
              var node = document.getElementById('media-lib');
              var arr = (JSON.parse(node.textContent) || []).filter(function (x) { return x.path !== it.path; });
              node.textContent = JSON.stringify(arr);
            } catch (e) {}
            cell.remove();
            status.textContent = 'Deleted'; status.className = 'mlib-status';
          } else {
            status.textContent = (res.j && res.j.error) || 'Delete failed.'; status.className = 'mlib-status err';
          }
        })
        .catch(function () { status.textContent = 'Delete failed — check your connection.'; status.className = 'mlib-status err'; });
    }

    head.querySelector('.mlib-search').addEventListener('input', function (e) { render(e.target.value); });
    head.querySelector('.mlib-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) close(); });

    var uploadBtn = head.querySelector('.mlib-upload');
    uploadBtn.addEventListener('click', function () { fileInp.click(); });
    fileInp.addEventListener('change', function () {
      var f = fileInp.files && fileInp.files[0];
      if (!f) return;
      status.textContent = 'Uploading…'; status.className = 'mlib-status busy';
      uploadBtn.disabled = true;
      var fd = new FormData(); fd.append('file', f);
      fetch('/media/upload-inline', { method: 'POST', body: fd })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j && res.j.ok) {
            // Add to the in-page list so it shows without a reload, then select it.
            try {
              var node = document.getElementById('media-lib');
              var arr = JSON.parse(node.textContent) || [];
              arr.unshift({ path: res.j.path, alt: '' });
              node.textContent = JSON.stringify(arr);
            } catch (e) {}
            status.textContent = ''; status.className = 'mlib-status';
            pick(res.j.path);
          } else {
            status.textContent = (res.j && res.j.error) || 'Upload failed.'; status.className = 'mlib-status err';
          }
        })
        .catch(function () { status.textContent = 'Upload failed — check your connection.'; status.className = 'mlib-status err'; })
        .then(function () { uploadBtn.disabled = false; fileInp.value = ''; });
    });

    return {
      open: function (base, current, onPick) {
        state.base = base; state.current = current || ''; state.onPick = onPick;
        head.querySelector('.mlib-search').value = '';
        status.textContent = ''; status.className = 'mlib-status';
        render('');
        overlay.hidden = false;
      },
    };
  }

  function openMediaLibrary(base, current, onPick) {
    if (!mediaLib) mediaLib = buildMediaLib();
    mediaLib.open(base, current, onPick);
  }

  /* ── Live preview: push field edits into the preview iframe ────────────── */
  function initLivePreview() {
    var pane = document.querySelector('.twopane');
    var iframe = document.getElementById('pv');
    if (!pane || !iframe) return;
    var origin = pane.getAttribute('data-preview-origin');
    var form = document.getElementById('editform');
    if (!form) return;

    function keyOf(el) {
      var n = el.getAttribute('name') || '';
      if (n.indexOf('f__') === 0) return n.slice(3);
      if (n === '__body') return null; // body is Markdown; not live-previewed
      return null;
    }
    function post(key, value) {
      try { iframe.contentWindow.postMessage({ type: 'cms', key: key, value: value }, origin); } catch (e) {}
    }
    function sendAll() {
      form.querySelectorAll('[name^="f__"]').forEach(function (el) {
        var k = keyOf(el); if (k) post(k, el.value);
      });
    }
    // The preview page announces when it's ready; send the current values then.
    window.addEventListener('message', function (e) {
      if (e.origin === origin && e.data && e.data.type === 'cms-preview-ready') sendAll();
    });
    form.addEventListener('input', function (e) {
      var k = keyOf(e.target); if (k) post(k, e.target.value);
      var s = document.getElementById('save-status'); if (s) s.textContent = 'Unsaved changes…';
    });
    var reload = document.getElementById('pv-reload');
    if (reload) reload.addEventListener('click', function () { iframe.contentWindow.location.reload(); });
  }

  /* ── Friendly list editors: class times, fees, co-teachers ────────────── */
  function selectDay(val) {
    var days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    var s = el('select', { class: 'in s-day' });
    days.forEach(function (d) {
      var o = el('option', { value: d }, [d]);
      if (d === val) o.selected = true;
      s.appendChild(o);
    });
    return s;
  }
  function timeInput(cls, val) {
    var i = el('input', { class: 'in ' + cls, type: 'time' });
    if (val) i.value = val;
    return i;
  }
  function feeItemRow(it) {
    it = it || {};
    return el('div', { class: 'item-row' }, [
      input('i-label', it.label), input('i-price', it.price), btn('rm rm-item', '×'),
    ]);
  }

  var BUILDERS = {
    sessions: {
      row: function (s) {
        s = s || {};
        return el('div', { class: 'rrow srow3' }, [
          field('Day', selectDay(s.day)),
          field('Start', timeInput('s-start', s.start)),
          field('End', timeInput('s-end', s.end)),
          field('Label (optional)', input('s-label', s.label)),
          btn('rm rm-row', 'Remove'),
        ]);
      },
      serialize: function (host) {
        var out = [];
        host.querySelectorAll('.rrow').forEach(function (r) {
          var start = r.querySelector('.s-start').value.trim();
          var end = r.querySelector('.s-end').value.trim();
          if (!start || !end) return;
          var o = { day: r.querySelector('.s-day').value, start: start, end: end };
          var label = r.querySelector('.s-label').value.trim(); if (label) o.label = label;
          out.push(o);
        });
        return out;
      },
    },
    coTeachers: {
      row: function (t) {
        t = t || {};
        return el('div', { class: 'rrow' }, [
          field('Name', input('c-name', t.name)),
          field('When (e.g. Wednesday 6:00–7:15pm)', input('c-when', t.when)),
          field('Phone', input('c-phone', t.phone)),
          field('Note (optional)', textarea('c-note', t.note, 2)),
          btn('rm rm-row', 'Remove'),
        ]);
      },
      serialize: function (host) {
        var out = [];
        host.querySelectorAll('.rrow').forEach(function (r) {
          var name = r.querySelector('.c-name').value.trim();
          if (!name) return;
          var o = { name: name };
          var when = r.querySelector('.c-when').value.trim(); if (when) o.when = when;
          var phone = r.querySelector('.c-phone').value.trim(); if (phone) o.phone = phone;
          var note = r.querySelector('.c-note').value.trim(); if (note) o.note = note;
          out.push(o);
        });
        return out;
      },
    },
    feeGroups: {
      row: function (g) {
        g = g || {};
        var itemsHost = el('div', { class: 'fee-items' }, (g.items || []).map(feeItemRow));
        var addItem = btn('add-btn add-item', '+ Add a price line');
        addItem.addEventListener('click', function () { itemsHost.appendChild(feeItemRow({})); });
        return el('div', { class: 'rrow fee-group' }, [
          field('Box title (e.g. Yoga & Meditation)', input('g-title', g.title)),
          field('When (e.g. Mon 7:30–8:45am)', input('g-duration', g.duration)),
          field('Single price (optional)', input('g-price', g.price)),
          field('Note (optional)', input('g-note', g.note)),
          el('div', { class: 'fee-items-wrap' }, [
            el('span', { class: 'fk sub' }, ['Price lines (label + price)']), itemsHost, addItem,
          ]),
          btn('rm rm-row', 'Remove this box'),
        ]);
      },
      serialize: function (host) {
        var out = [];
        host.querySelectorAll('.fee-group').forEach(function (r) {
          var title = r.querySelector('.g-title').value.trim();
          if (!title) return;
          var o = { title: title };
          var dur = r.querySelector('.g-duration').value.trim(); if (dur) o.duration = dur;
          var price = r.querySelector('.g-price').value.trim(); if (price) o.price = price;
          var note = r.querySelector('.g-note').value.trim(); if (note) o.note = note;
          var items = [];
          r.querySelectorAll('.item-row').forEach(function (ir) {
            var label = ir.querySelector('.i-label').value.trim();
            var ip = ir.querySelector('.i-price').value.trim();
            if (!label) return;
            var io = { label: label }; if (ip) io.price = ip;
            items.push(io);
          });
          if (items.length) o.items = items;
          out.push(o);
        });
        return out;
      },
    },
  };

  function initRepeatables() {
    document.querySelectorAll('.repeat').forEach(function (root) {
      var kind = root.getAttribute('data-kind');
      var builder = BUILDERS[kind];
      if (!builder) return;
      var rowsHost = root.querySelector('.repeat-rows');
      var seed = [];
      try { seed = JSON.parse(root.querySelector('.repeat-seed').textContent) || []; } catch (e) {}
      seed.forEach(function (item) { rowsHost.appendChild(builder.row(item)); });
      root.querySelector('.repeat-add').addEventListener('click', function () {
        rowsHost.appendChild(builder.row({}));
      });
      root.addEventListener('click', function (e) {
        if (e.target.classList.contains('rm-row')) { var r = e.target.closest('.rrow'); if (r) r.remove(); }
        else if (e.target.classList.contains('rm-item')) { var it = e.target.closest('.item-row'); if (it) it.remove(); }
      });
      var hidden = root.parentNode.querySelector('input[name="f__' + kind + '"]');
      var form = root.closest('form');
      if (form && hidden) {
        form.addEventListener('submit', function () {
          hidden.value = JSON.stringify(builder.serialize(rowsHost));
        });
      }
    });
  }

  /* ── Drag-to-reorder a collection list ────────────────────────────────── */
  function initReorder() {
    var list = document.querySelector('.dlist');
    if (!list) return;
    var saveBtn = document.getElementById('save-order');
    var orderVal = document.getElementById('order-val');
    var form = document.getElementById('reorder');
    var dragEl = null;

    function afterElement(y) {
      var els = Array.prototype.slice.call(list.querySelectorAll('.drow:not(.dragging)'));
      var closest = null, closestOffset = -Infinity;
      els.forEach(function (el) {
        var box = el.getBoundingClientRect();
        var offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closestOffset) { closestOffset = offset; closest = el; }
      });
      return closest;
    }
    list.addEventListener('dragstart', function (e) {
      var row = e.target.closest('.drow'); if (!row) return;
      dragEl = row; row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', row.getAttribute('data-path') || ''); } catch (_) {}
    });
    list.addEventListener('dragend', function () {
      if (dragEl) dragEl.classList.remove('dragging'); dragEl = null;
    });
    list.addEventListener('dragover', function (e) {
      if (!dragEl) return;
      e.preventDefault();
      var after = afterElement(e.clientY);
      if (after == null) list.appendChild(dragEl); else list.insertBefore(dragEl, after);
      if (saveBtn) saveBtn.disabled = false;
    });
    if (form && orderVal) form.addEventListener('submit', function () {
      var paths = Array.prototype.map.call(list.querySelectorAll('.drow'), function (r) { return r.getAttribute('data-path'); });
      orderVal.value = JSON.stringify(paths);
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    });
  }

  /* ── Confirm dialogs (CSP-safe: no inline handlers) ───────────────────── */
  function initConfirms() {
    document.querySelectorAll('form[data-confirm]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        if (!window.confirm(f.getAttribute('data-confirm'))) e.preventDefault();
      });
    });
  }

  /* ── Wire up on load ──────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initImagePickers();
    initLivePreview();
    initRepeatables();
    initReorder();
    initConfirms();

    var root = document.getElementById('structured');
    if (!root) return;
    var kind = root.getAttribute('data-editor');
    var data = {};
    try { data = JSON.parse(document.getElementById('structured-data').textContent); } catch (e) {}
    var linkOpts = [];
    try { linkOpts = JSON.parse(document.getElementById('link-options').textContent) || []; } catch (e) {}
    var serialize = kind === 'timetable' ? initTimetable(root, data, linkOpts)
      : kind === 'faq' ? initFaq(root, data) : null;
    if (!serialize) return;
    root.closest('form').addEventListener('submit', function () {
      document.getElementById('__json').value = JSON.stringify(serialize());
    });
  });
})();
`;
