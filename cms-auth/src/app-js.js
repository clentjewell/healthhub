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

  /* ── Wire up on load ──────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
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
