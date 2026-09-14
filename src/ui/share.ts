import { sfx } from '../audio';
import { track } from '../analytics';
import { h } from './dom';

export const SITE_URL = 'https://shiritori.ak-base.com/';
const SHARE_TEXT = '漢字の熟語をつなぐ「パンしりとり」。小学生向けの漢字あそびアプリです。';

/** ともだちに教える（QR・URL・コピー・LINE・共有） */
export function openShareModal(): void {
  const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(SITE_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`;
  const canShare = typeof navigator.share === 'function';
  const msg = h('div', { class: 'sub center', style: { minHeight: '1.5em' } });
  const overlay = h('div', { class: 'overlay', onClick: (e: Event) => { if (e.target === overlay) overlay.remove(); } },
    h('div', { class: 'modal', style: { textAlign: 'center' } },
      h('h2', null, 'ともだちに おしえる'),
      h('p', { class: 'sub' }, 'この QR コードを よみとるか、URL を おくってね'),
      h('img', { src: `${import.meta.env.BASE_URL}qr.png`, alt: 'QRコード', style: { width: 'min(260px, 60vw)', height: 'auto', borderRadius: '16px', background: '#fff', padding: '8px' } }),
      h('div', { class: 'card', style: { margin: '10px auto', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.95rem', userSelect: 'text', WebkitUserSelect: 'text' } }, SITE_URL),
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        h('button', { class: 'btn ghost', onClick: async () => {
          try { await navigator.clipboard.writeText(SITE_URL); msg.textContent = 'URL を コピーしたよ'; sfx.good(); } catch { msg.textContent = 'コピーできませんでした。URL を なぞって コピーしてね'; }
          track('share', { method: 'copy' });
        } }, '📋 URL を コピー'),
        h('a', { class: 'btn', style: { background: '#06c755' }, href: lineUrl, target: '_blank', rel: 'noopener', onClick: () => track('share', { method: 'line' }) }, '💬 LINE で おくる'),
        canShare ? h('button', { class: 'btn blue', onClick: async () => {
          try { await navigator.share({ title: 'パンしりとり', text: SHARE_TEXT, url: SITE_URL }); track('share', { method: 'native' }); } catch { /* キャンセル */ }
        } }, '📤 ほかの アプリで') : null,
      ),
      msg,
      h('div', { style: { marginTop: '12px' } }, h('button', { class: 'btn ghost small', onClick: () => overlay.remove() }, 'とじる')),
    ),
  );
  document.body.appendChild(overlay);
}
