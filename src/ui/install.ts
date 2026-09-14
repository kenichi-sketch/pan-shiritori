import { sfx } from '../audio';
import { track } from '../analytics';
import { h } from './dom';

/** ホーム画面に追加（ブックマーク）の案内（2026-09-15）。
 *  ブラウザの仕様上、ブックマークをページから直接作ることはできない。
 *  Android/PC の Chrome は「インストール」の確認を出せる（beforeinstallprompt）。
 *  iPhone の Safari は API が無いので、操作の手順を見せる。 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let deferred: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BeforeInstallPromptEvent; });
window.addEventListener('appinstalled', () => { deferred = null; track('install', { method: 'prompt' }); });

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function platform(): 'ios' | 'android' | 'pc' {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'pc';
}

/** 共有画面などに埋め込む「ホーム画面に入れる」ブロック */
export function installBlock(): HTMLElement {
  if (isStandalone()) {
    return h('div', { class: 'install-block' }, h('div', { class: 'sub' }, '✓ ホーム画面から ひらいています'));
  }
  const p = platform();
  const msg = h('div', { class: 'sub', style: { minHeight: '1.5em' } });
  let how: HTMLElement;
  if (deferred) {
    how = h('button', { class: 'btn green small', onClick: async () => {
      const d = deferred; if (!d) return;
      sfx.tap();
      await d.prompt();
      const r = await d.userChoice;
      deferred = null;
      msg.textContent = r.outcome === 'accepted' ? 'ホーム画面に 入れたよ！' : 'また あとでね';
      track('install', { method: 'button', outcome: r.outcome });
    } }, '📲 ホーム画面に 追加する');
  } else if (p === 'ios') {
    how = h('div', { class: 'install-steps' },
      h('div', null, '① 画面の 下の ', h('b', null, '共有ボタン（□に↑）'), ' を おす'),
      h('div', null, '② ', h('b', null, '「ホーム画面に追加」'), ' を えらぶ'),
      h('div', { class: 'sub' }, 'ブックマークにするときは 同じ 共有ボタンから「ブックマークを追加」'),
    );
  } else if (p === 'android') {
    how = h('div', { class: 'install-steps' },
      h('div', null, '① 右上の ', h('b', null, '「⋮」'), ' を おす'),
      h('div', null, '② ', h('b', null, '「ホーム画面に追加」'), ' か ', h('b', null, '「アプリをインストール」'), ' を えらぶ'),
      h('div', { class: 'sub' }, 'ブックマークにするときは 同じ メニューの「☆」'),
    );
  } else {
    how = h('div', { class: 'install-steps' },
      h('div', null, 'アドレスバーの 右の ', h('b', null, '「☆」'), ' で ブックマーク（Ctrl+D）'),
      h('div', { class: 'sub' }, 'Chrome / Edge なら アドレスバー右の「インストール」で アプリのように 使えます'),
    );
  }
  return h('div', { class: 'install-block' },
    h('div', { class: 'install-title' }, '📲 つぎも すぐ ひらけるように'),
    how,
    msg,
  );
}

/** ホーム画面の小さなボタンから開く案内だけのモーダル */
export function openInstallModal(): void {
  const overlay = h('div', { class: 'overlay', onClick: (e: Event) => { if (e.target === overlay) overlay.remove(); } },
    h('div', { class: 'modal', style: { textAlign: 'center' } },
      h('h2', null, 'ホーム画面に 入れる'),
      installBlock(),
      h('div', { style: { marginTop: '12px' } }, h('button', { class: 'btn ghost small', onClick: () => overlay.remove() }, 'とじる')),
    ),
  );
  document.body.appendChild(overlay);
  track('install', { method: 'open_modal' });
}
