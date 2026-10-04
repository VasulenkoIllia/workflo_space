// proto-modal.jsx — reusable imperative modal for the prototype.
// window.wfModal({ title, subtitle, fields, confirmLabel, danger, note, onConfirm })
//   fields: [{ key, label, type:'text'|'select'|'textarea'|'static', value, placeholder, options:[[v,l]] }]
// Returns nothing; on confirm calls onConfirm(values) then closes + success toast.
// window.wfConfirm({ title, message, confirmLabel, danger, onConfirm }) — quick confirm.

(function () {
  if (window.__wfModalInit) return;
  window.__wfModalInit = true;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function close(ov) {
    ov.classList.remove('in');
    setTimeout(() => ov.remove(), 200);
  }

  window.wfModal = function (cfg) {
    cfg = cfg || {};
    const fields = cfg.fields || [];
    const ov = el('div', 'wfm-overlay');
    const box = el('div', 'wfm-box');
    ov.appendChild(box);

    // header
    const h = el('div', 'wfm-h');
    h.appendChild(el('div', 'wfm-h-t', '<span>' + (cfg.title || 'Дія') + '</span>' + (cfg.subtitle ? '<span class="wfm-h-s">' + cfg.subtitle + '</span>' : '')));
    const x = el('button', 'wfm-x', '✕');
    x.onclick = () => close(ov);
    h.appendChild(x);
    box.appendChild(h);

    // body
    const body = el('div', 'wfm-body');
    const inputs = {};
    fields.forEach((f) => {
      const wrap = el('div', 'wfm-field');
      if (f.type !== 'static') wrap.appendChild(el('label', null, f.label || ''));
      let inp;
      if (f.type === 'select') {
        inp = el('select', 'wfm-input');
        (f.options || []).forEach(([v, l]) => {
          const o = el('option'); o.value = v; o.textContent = l; inp.appendChild(o);
        });
        if (f.value != null) inp.value = f.value;
      } else if (f.type === 'textarea') {
        inp = el('textarea', 'wfm-input');
        inp.rows = 3; inp.value = f.value || ''; inp.placeholder = f.placeholder || '';
      } else if (f.type === 'static') {
        wrap.appendChild(el('div', 'wfm-static', (f.label ? '<span class="wfm-static-k">' + f.label + '</span>' : '') + '<span>' + (f.value || '') + '</span>'));
      } else {
        inp = el('input', 'wfm-input');
        inp.type = f.type || 'text'; inp.value = f.value || ''; inp.placeholder = f.placeholder || '';
      }
      if (inp) { inp.dataset.key = f.key; wrap.appendChild(inp); inputs[f.key] = inp; }
      body.appendChild(wrap);
    });
    if (cfg.note) body.appendChild(el('div', 'wfm-note', cfg.note));
    box.appendChild(body);

    // footer
    const foot = el('div', 'wfm-foot');
    const cancel = el('button', 'wfm-btn', cfg.cancelLabel || 'Скасувати');
    cancel.onclick = () => close(ov);
    const ok = el('button', 'wfm-btn wfm-btn--primary' + (cfg.danger ? ' wfm-btn--danger' : ''), cfg.confirmLabel || 'Зберегти');
    ok.onclick = () => {
      const vals = {};
      Object.keys(inputs).forEach((k) => { vals[k] = inputs[k].value; });
      close(ov);
      if (cfg.onConfirm) cfg.onConfirm(vals);
      if (cfg.successToast !== false) window.wfToast && window.wfToast(cfg.successToast || (cfg.confirmLabel ? cfg.confirmLabel + ' — готово' : 'Збережено'), cfg.danger ? 'warn' : 'ok');
    };
    foot.appendChild(cancel); foot.appendChild(ok);
    box.appendChild(foot);

    ov.addEventListener('click', (e) => { if (e.target === ov) close(ov); });
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('in'));
    const first = box.querySelector('.wfm-input');
    if (first) setTimeout(() => first.focus(), 60);
  };

  window.wfConfirm = function (cfg) {
    cfg = cfg || {};
    window.wfModal({
      title: cfg.title || 'Підтвердити дію',
      fields: cfg.message ? [{ type: 'static', value: cfg.message }] : [],
      confirmLabel: cfg.confirmLabel || 'Підтвердити',
      cancelLabel: cfg.cancelLabel,
      danger: cfg.danger,
      note: cfg.note,
      successToast: cfg.successToast,
      onConfirm: cfg.onConfirm,
    });
  };
})();
