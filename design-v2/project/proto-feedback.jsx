// proto-feedback.jsx — global interaction feedback layer for the prototype.
// Goal: let the user click through the WHOLE prototype and instantly see what
// is wired vs. a stub. A MutationObserver watches whether a click changed the
// DOM. Real handlers mutate → silent. Dead buttons don't → a toast surfaces
// "дія ще не підключена", turning click-through into a live audit.

(function () {
  if (window.__wfFeedbackInit) return;
  window.__wfFeedbackInit = true;

  // ── toast container + imperative API ──
  function ensureHost() {
    let h = document.getElementById('wf-toast-host');
    if (!h) {
      h = document.createElement('div');
      h.id = 'wf-toast-host';
      h.className = 'wf-toast-host';
      document.body.appendChild(h);
    }
    return h;
  }
  const ICONS = {
    ok: '✓', info: '›', stub: '∅', warn: '⚠',
  };
  window.wfToast = function (msg, kind) {
    kind = kind || 'info';
    window.__wfToastTick = (window.__wfToastTick || 0) + 1;
    const host = ensureHost();
    const t = document.createElement('div');
    t.className = 'wf-toast';
    t.setAttribute('data-kind', kind);
    t.innerHTML = '<span class="wf-toast-ic">' + (ICONS[kind] || '›') + '</span><span class="wf-toast-msg"></span>';
    t.querySelector('.wf-toast-msg').textContent = msg;
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    const ttl = kind === 'stub' ? 2600 : 2000;
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 240); }, ttl);
    // cap stack
    while (host.children.length > 4) host.firstChild.remove();
  };

  // ── content-change detector ──
  // Snapshot a meaningful signal (open modals + main-content size). A real
  // handler swaps content / opens a modal / toggles rows → signal changes.
  // A dead button leaves it identical.
  function signal() {
    const modals = document.querySelectorAll('.wfp-modal-overlay, .wfp-modal, [role="dialog"], .wfp-menu, .wfp-sheet, .wfpi, .wfd-gate-block, .wfm-overlay').length;
    const main = document.querySelector('.wfp-content') || document.querySelector('.proto-screen') || document.querySelector('.proto-stage-inner') || document.body;
    const len = main ? main.innerHTML.length : 0;
    const active = (document.querySelector('.wfp-sb-item[data-on]') || {}).textContent || '';
    return modals * 5000003 + len + active.length;
  }

  // Selectors that look like actionable controls
  const ACTION_SEL = 'button, .wfp-btn, .wfp-iconbtn, .wfp-pill, [role="button"]';
  // Buttons whose "no DOM change" is legitimate (copy, external, download, demos)
  const SILENT_RE = /(копіюва|copy|завантажити|download|pdf|експорт|export|відкрити на сайті|на сайті|csv|xlsx|zip)/i;

  document.addEventListener('click', function (e) {
    const btn = e.target.closest(ACTION_SEL);
    if (!btn || btn.disabled) return;
    if (btn.closest('#wf-toast-host')) return;
    if (btn.hasAttribute('data-no-toast')) return;
    if (btn.closest('.proto-tabs, .proto-toolbar, .tweaks-panel, [data-tweaks-root], .wfm-overlay')) return;
    const before = signal();
    const tick0 = window.__wfToastTick || 0;
    const label = (btn.getAttribute('aria-label') || btn.getAttribute('title') || btn.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 42);
    const silent = SILENT_RE.test(label);
    setTimeout(function () {
      if (signal() !== before) return; // real handler changed the view
      if ((window.__wfToastTick || 0) !== tick0) return; // handler showed its own toast
      if (silent) { window.wfToast((label || 'дія') + ' — демо', 'ok'); return; }
      window.wfToast('«' + (label || 'дія') + '» — ще не підключено', 'stub');
    }, 130);
  }, true);

  if (document.body) ensureHost();
  else document.addEventListener('DOMContentLoaded', ensureHost);

  // ── global visual toggle for filter pills/chips (single-select within a group) ──
  // Makes unwired filter controls feel responsive everywhere. React-controlled
  // pills get restored on next render; dead pills stay visually selected. The
  // data-on mutation also suppresses the stub-toast (signal changes).
  const TOGGLE_SEL = '.wfp-pill, .wfp-chip';
  document.addEventListener('click', function (e) {
    const pill = e.target.closest(TOGGLE_SEL);
    if (!pill || pill.disabled) return;
    if (pill.closest('.wfm-overlay, #wf-toast-host')) return;
    const group = pill.parentElement;
    if (!group) return;
    Array.prototype.forEach.call(group.children, function (c) {
      if (c !== pill && (c.classList.contains('wfp-pill') || c.classList.contains('wfp-chip'))) c.removeAttribute('data-on');
    });
    pill.setAttribute('data-on', 'true');
  }, false);
})();
