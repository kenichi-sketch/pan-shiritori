import { Dictionary } from '../data';
import { availableCategories, reportWord, schoolGrade } from '../profile';
import { speak, sfx } from '../audio';
import type { Category, Profile } from '../types';
import { CATEGORY_LABEL } from '../types';
import { clear, h } from './dom';

export function mountZukan(root: HTMLElement, dict: Dictionary, p: Profile, onBack: () => void): void {
  const cats = availableCategories(p);
  let cat: Category = cats[cats.length - 1];
  const gridEl = h('div', { class: 'zukan-grid' });
  const headEl = h('div', null);
  const chipsEl = h('div', { class: 'chips', style: { marginBottom: '10px' } });

  function totalFor(c: Category): number {
    const k = Dictionary.maxKid(c);
    let n = 0;
    for (const w of dict.words.values()) if (w.g === c && w.k <= k) n++;
    return n;
  }

  function render(): void {
    clear(chipsEl);
    for (const c of cats) {
      chipsEl.appendChild(h('button', { class: `chip ${c === cat ? 'active' : ''}`, onClick: () => { sfx.tap(); cat = c; render(); } }, CATEGORY_LABEL[c]));
    }
    const collected = Object.entries(p.progress.collected)
      .map(([w, d]) => ({ info: dict.words.get(w), d }))
      .filter((x) => x.info && x.info.g === cat)
      .sort((a, b) => (a.d < b.d ? 1 : -1));
    const total = totalFor(cat);
    clear(headEl);
    headEl.appendChild(h('div', { class: 'card', style: { marginBottom: '10px' } },
      h('div', { class: 'row' }, h('strong', null, `${CATEGORY_LABEL[cat]}の ことば`), h('span', { class: 'grow' }), h('span', null, `${collected.length} / ${total}`)),
      h('div', { class: 'progress-bar', style: { marginTop: '6px' } }, h('i', { style: { width: `${total ? Math.min(100, (collected.length / total) * 100) : 0}%` } })),
    ));
    clear(gridEl);
    if (!collected.length) gridEl.appendChild(h('p', { class: 'sub' }, 'まだ ことばが ないよ。しりとりで ことばを つくると ここに あつまるよ！'));
    for (const { info } of collected) {
      if (!info) continue;
      gridEl.appendChild(h('div', { class: 'zukan-item', onClick: () => speak(info.r) },
        h('div', { class: 'w' }, info.w), h('div', { class: 'rd' }, info.r), info.m ? h('div', { class: 'mn' }, info.m) : null,
        h('button', { class: 'flag small-flag', onClick: async (e: Event) => {
          e.stopPropagation();
          const btn = e.currentTarget as HTMLButtonElement; btn.disabled = true; btn.textContent = '…';
          await reportWord({ word: info.w, reading: info.r, cat, grade: schoolGrade(p.birth) });
          btn.textContent = '✓';
        } }, '🚩 へん？')));
    }
  }
  render();

  clear(root);
  root.appendChild(h('div', { class: 'screen' },
    h('div', { class: 'topbar' }, h('button', { class: 'icon-btn', onClick: onBack }, '←'), h('h1', { class: 'title' }, '📖 ことばずかん'), h('span', { class: 'spacer' }), h('span', { class: 'sub' }, 'タップで よみあげ')),
    chipsEl, headEl, gridEl,
  ));
}
