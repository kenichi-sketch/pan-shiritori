import { breadImage } from '../chars';
import { bestsFor, fmtTime, fmtTimeShort, rankingFor } from '../ranking';
import type { Category, Profile } from '../types';
import { CATEGORIES, CATEGORY_LABEL } from '../types';
import { availableCategories } from '../profile';
import { sfx } from '../audio';
import { h } from './dom';

/** 得点一覧（本人の最高点 + この端末のランキング）。ホームの小さなボタンから開く */
export function openScoresModal(p: Profile, initialCat?: Category): void {
  const cats = availableCategories(p);
  let cat: Category = initialCat && cats.includes(initialCat) ? initialCat : cats[cats.length - 1];
  const bests = bestsFor(p.id);
  const bestByCat = new Map(bests.filter((b) => b.level === 0).map((b) => [b.cat, b]));

  const chips = h('div', { class: 'chips', style: { justifyContent: 'center' } });
  const body = h('div', null);

  function render(): void {
    chips.replaceChildren(...CATEGORIES.filter((c) => cats.includes(c)).map((c) =>
      h('button', { class: `chip ${c === cat ? 'active' : ''}`, onClick: () => { sfx.tap(); cat = c; render(); } }, CATEGORY_LABEL[c])));
    const mine = bestByCat.get(cat);
    const list = rankingFor(cat, 0, 5).slice(0, 10);
    body.replaceChildren(
      h('div', { class: 'stat', style: { justifyContent: 'center', marginBottom: '10px' } },
        mine ? ['🏅 じぶんの さいこう ', h('span', { class: 'num' }, `${mine.score}`), '点 ', h('span', { class: 'sub' }, `（${fmtTime(mine.ms)}）`)] : 'まだ きろくが ないよ'),
      list.length
        ? h('table', { class: 'rank-table' },
          ...list.map((r, i) => h('tr', { class: r.profileId === p.id ? 'me' : '' },
            h('td', { class: 'rk' }, `${i + 1}い`),
            h('td', null, h('img', { src: breadImage(r.bread), alt: '' })),
            h('td', { class: 'nm' }, r.name),
            h('td', { class: 'sc' }, `${r.score}点`),
            h('td', { class: 'tm' }, fmtTimeShort(r.ms)),
          )))
        : h('p', { class: 'sub center' }, 'タイムアタックを あそぶと ここに ならぶよ'),
    );
  }
  render();

  const overlay = h('div', { class: 'overlay', onClick: (e: Event) => { if (e.target === overlay) overlay.remove(); } },
    h('div', { class: 'modal' },
      h('h2', null, '🏅 とくてん いちらん'),
      h('p', { class: 'sub center', style: { margin: '0 0 8px' } }, 'タイムアタック（レベル1〜5 とおし・とくてん けいさん）の きろく。この たんまつで あそんだ ひとの ぶん'),
      chips,
      h('div', { style: { marginTop: '10px' } }, body),
      h('div', { class: 'center', style: { marginTop: '12px' } }, h('button', { class: 'btn ghost small', onClick: () => overlay.remove() }, 'とじる')),
    ),
  );
  document.body.appendChild(overlay);
}
