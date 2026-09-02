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
  function sessionRow(s) {
    s = s || {};
    var wrap = el('div', { class: 'srow' }, [
      field('Class / session', input('s-name', s.name)),
      field('Time (as shown)', input('s-time', s.time)),
      field('Link (optional)', input('s-href', s.href)),
      btn('rm', 'Remove'),
    ]);
    return wrap;
  }
  function initTimetable(root, data) {
    var days = (data.days || []);
    var host = el('div', {});
    days.forEach(function (d) {
      var sessWrap = el('div', { class: 'sessions' }, (d.sessions || []).map(sessionRow));
      var add = btn('add-btn', '+ Add a class to ' + d.day);
      add.addEventListener('click', function () { sessWrap.appendChild(sessionRow({})); });
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

  /* ── Image picker: live preview + auto-fill alt from the media library ──── */
  function initImagePickers() {
    var baseEl = document.getElementById('img-base');
    var base = baseEl ? baseEl.getAttribute('data-base') : '';
    var altMap = {};
    try { altMap = JSON.parse(document.getElementById('alt-map').textContent); } catch (e) {}
    document.querySelectorAll('.img-field').forEach(function (inp) {
      var wrap = inp.closest('.fl');
      var prev = wrap ? wrap.querySelector('.img-prev') : null;
      function sync() {
        var v = inp.value.trim();
        if (prev) { prev.src = v ? base + v : ''; prev.style.display = v ? '' : 'none'; }
        var form = inp.closest('form');
        var alt = form && form.querySelector('input[name*="alt" i], textarea[name*="alt" i]');
        if (alt && !alt.value.trim() && altMap[v]) alt.value = altMap[v];
      }
      inp.addEventListener('input', sync);
      inp.addEventListener('change', sync);
    });
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

  /* ── Wire up on load ──────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initImagePickers();
    initLivePreview();
    initRepeatables();

    var root = document.getElementById('structured');
    if (!root) return;
    var kind = root.getAttribute('data-editor');
    var data = {};
    try { data = JSON.parse(document.getElementById('structured-data').textContent); } catch (e) {}
    var serialize = kind === 'timetable' ? initTimetable(root, data)
      : kind === 'faq' ? initFaq(root, data) : null;
    if (!serialize) return;
    root.closest('form').addEventListener('submit', function () {
      document.getElementById('__json').value = JSON.stringify(serialize());
    });
  });
})();
`;
