(() => {
  'use strict';
  if (window.__ONECLICK_SUPPORT_DONATE__) return;
  window.__ONECLICK_SUPPORT_DONATE__ = true;

  const WRAPPER_SELECTOR = '#app > main.h-lvh > div.min-h-full.h-full.p-3.text-xs.relative';
  const QR_SRC = '../../../assets/donate-qr-mbbank.png';

  const SUPPORT_LINKS = [
    { href: 'https://zalo.me/0328908218', label: 'Zalo', icon: 'pi-comments' },
    { href: 'https://www.facebook.com/minhkhanhzl96', label: 'Facebook', icon: 'pi-facebook' },
    { href: 'https://1clickvn.com/workshop/', label: 'Website', icon: 'pi-globe' },
  ];
  const BANK = { name: 'MB Bank', account: '09996618888', holder: 'NGUYỄN MINH KHÁNH' };

  const CSS = `
.oc-support{margin-top:12px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;padding:12px;color:#0f172a;font-size:12px}
.oc-support__title{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;margin:0 0 10px}
.oc-support__title .pi{color:#2563eb}
.oc-support__links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.oc-support__link{display:flex;align-items:center;justify-content:center;gap:6px;padding:7px 8px;border:1px solid #bfdbfe;border-radius:8px;color:#1d4ed8;background:#eff6ff;font-weight:600;text-decoration:none;white-space:nowrap}
.oc-support__link:hover{background:#dbeafe;border-color:#93c5fd}
.oc-support__donate{display:flex;gap:12px;align-items:center;margin-top:10px;padding-top:10px;border-top:1px dashed #e2e8f0}
.oc-support__qr{flex:none;width:104px;height:104px;border:1px solid #e2e8f0;border-radius:8px;padding:4px;background:#fff;cursor:zoom-in}
.oc-support__qr img{width:100%;height:100%;display:block}
.oc-support__info{min-width:0;line-height:1.55}
.oc-support__heading{font-weight:600;color:#0f172a}
.oc-support__muted{color:#64748b}
.oc-support__acc{display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px;letter-spacing:.02em;font-variant-numeric:tabular-nums}
.oc-support__copy{border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:600;color:#334155;cursor:pointer}
.oc-support__copy:hover{border-color:#2563eb;color:#1d4ed8}
.oc-support-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border:1px solid #bfdbfe;border-radius:6px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}
.oc-support-btn:hover{background:#dbeafe}
.oc-donate-modal{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.45)}
.oc-donate-modal__box{width:min(100%,320px);background:#fff;border-radius:12px;padding:16px;text-align:center;color:#0f172a;box-shadow:0 20px 40px rgba(0,0,0,.2);position:relative}
.oc-donate-modal__box img{width:100%;max-width:260px;aspect-ratio:1;display:block;margin:8px auto;border:1px solid #e2e8f0;border-radius:8px}
.oc-donate-modal__close{position:absolute;top:8px;right:8px;border:0;background:transparent;color:#64748b;cursor:pointer;font-size:14px;padding:4px}
.oc-donate-modal__close:hover{color:#0f172a}
`;

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const child of children || []) node.appendChild(child);
    return node;
  }
  const icon = (name) => el('i', { class: `pi ${name}`, 'aria-hidden': 'true' });

  function copyAccount(button) {
    const done = () => {
      button.textContent = 'Đã copy';
      setTimeout(() => { button.textContent = 'Copy'; }, 1500);
    };
    navigator.clipboard?.writeText(BANK.account).then(done).catch(() => {
      const ta = el('textarea', {});
      ta.value = BANK.account;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    });
  }

  function bankInfo() {
    const copyBtn = el('button', { type: 'button', class: 'oc-support__copy', text: 'Copy', title: 'Copy số tài khoản' });
    copyBtn.addEventListener('click', () => copyAccount(copyBtn));
    return el('div', { class: 'oc-support__info' }, [
      el('div', { class: 'oc-support__heading', text: 'Ủng hộ tác giả' }),
      el('div', { class: 'oc-support__muted', text: BANK.name }),
      el('div', { class: 'oc-support__acc' }, [el('span', { text: BANK.account }), copyBtn]),
      el('div', { text: BANK.holder }),
    ]);
  }

  function openQrModal() {
    if (document.querySelector('.oc-donate-modal')) return;
    const close = () => { modal.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const info = bankInfo();
    info.style.textAlign = 'center';
    info.querySelector('.oc-support__acc').style.justifyContent = 'center';
    const modal = el('div', { class: 'oc-donate-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Mã QR ủng hộ' }, [
      el('div', { class: 'oc-donate-modal__box' }, [
        el('button', { type: 'button', class: 'oc-donate-modal__close', 'aria-label': 'Đóng', onclick: close }, [icon('pi-times')]),
        el('div', { class: 'oc-support__title', style: 'justify-content:center;margin:0' }, [icon('pi-heart'), el('span', { text: 'Quét mã để ủng hộ' })]),
        el('img', { src: QR_SRC, alt: `QR chuyển khoản ${BANK.name} ${BANK.account}` }),
        info,
      ]),
    ]);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(modal);
  }

  function buildSection() {
    return el('div', { class: 'oc-support', id: 'oc-support' }, [
      el('div', { class: 'oc-support__title' }, [icon('pi-headphones'), el('span', { text: 'Hỗ trợ & Ủng hộ' })]),
      el('div', { class: 'oc-support__links' }, SUPPORT_LINKS.map(({ href, label, icon: name }) =>
        el('a', { class: 'oc-support__link', href, target: '_blank', rel: 'noopener noreferrer' }, [icon(name), el('span', { text: label })]))),
      el('div', { class: 'oc-support__donate' }, [
        el('div', { class: 'oc-support__qr', title: 'Bấm để phóng to', role: 'button', tabindex: '0', onclick: openQrModal,
          onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openQrModal(); } } },
          [el('img', { src: QR_SRC, alt: `QR ${BANK.name} ${BANK.account}` })]),
        bankInfo(),
      ]),
    ]);
  }

  function buildHeaderButton() {
    return el('button', { type: 'button', class: 'oc-support-btn', id: 'oc-support-btn', title: 'Hỗ trợ & Ủng hộ', onclick: openQrModal },
      [icon('pi-heart'), el('span', { text: 'Ủng hộ' })]);
  }

  // The app is compiled Vue; our nodes live alongside it, so re-attach them if a re-render drops them.
  function ensureMounted() {
    const wrapper = document.querySelector(WRAPPER_SELECTOR);
    if (!wrapper) return;
    if (!document.getElementById('oc-support-style')) {
      document.head.appendChild(el('style', { id: 'oc-support-style', text: CSS }));
    }
    if (!document.getElementById('oc-support') || wrapper.lastElementChild?.id !== 'oc-support') {
      wrapper.appendChild(document.getElementById('oc-support') || buildSection());
    }
    const guide = wrapper.querySelector('header a[href*="1clickvn"], header a[href*="workshop"], header a[title]');
    if (guide && !document.getElementById('oc-support-btn')) {
      guide.parentElement.insertBefore(buildHeaderButton(), guide);
    }
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; ensureMounted(); });
  }

  function start() {
    ensureMounted();
    new MutationObserver(schedule).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    setTimeout(ensureMounted, 300);
    setTimeout(ensureMounted, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
