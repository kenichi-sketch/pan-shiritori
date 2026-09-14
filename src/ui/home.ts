import type { Dictionary } from '../data';
import { BREADS, PANURANAI_URL, breadImage } from '../chars';
import { CLEARS_TO_UNLOCK, L5_CLEARS_PER_STAR, availableCategories, categoryForGrade, gradeLabel, level5Star, maxUnlockedLevel, nextCategory, saveProfile, schoolGrade, todayStr } from '../profile';
import { bestFor, fmtTime } from '../ranking';
import { sfx } from '../audio';
import type { Category, Profile } from '../types';
import { CATEGORIES, CATEGORY_LABEL } from '../types';
import { Character } from './character';
import { clear, h } from './dom';
import { openShareModal } from './share';
import { isStandalone, openInstallModal } from './install';

export interface HomeActions {
  play: (cat: Category, level: number) => void;
  daily: (cat: Category, level: number) => void;
  score: (cat: Category, level: number, count: number) => void;
  zukan: () => void;
  parent: () => void;
  switchProfile: () => void;
}

const LEVEL_DESC = ['3まい', '4まい', '5まい', '6まい', '7まい'];
const KEY_CAT = 'panshiri.selcat.';

export function mountHome(root: HTMLElement, dict: Dictionary, p: Profile, act: HomeActions): () => void {
  const cats = availableCategories(p);
  const saved = Number(localStorage.getItem(KEY_CAT + p.id) || '');
  let cat: Category = (cats as number[]).includes(saved) ? (saved as Category) : categoryForGrade(schoolGrade(p.birth));
  if (!cats.includes(cat)) cat = cats[cats.length - 1];
  const maxLv = maxUnlockedLevel(p);
  const star = level5Star(p);
  const hour = new Date().getHours();
  const greet = hour < 10 ? 'おはよう' : hour < 17 ? 'こんにちは' : 'こんばんは';
  const dailyDone = p.progress.dailyDone === todayStr();
  const bread = BREADS[p.bread];

  const ch = new Character(p.bread, 130);
  ch.mood('wave', 1300);

  function goalText(): string {
    if (p.progress.totalPuzzles === 0) return 'まずは 「レベル1」を おしてみよう！';
    const parts: string[] = [];
    if (maxLv < 5) parts.push(`レベル${maxLv + 1}が ひらくまで あと${CLEARS_TO_UNLOCK - (p.progress.clears[maxLv] ?? 0)}かい`);
    const nx = nextCategory(cat);
    if (nx && !cats.includes(nx) && maxLv >= 3) parts.push(`レベル3を クリアすると 「${CATEGORY_LABEL[nx]}」の かんじが ひらくよ`);
    else if (nx && !cats.includes(nx)) parts.push(`レベル3まで いくと つぎの がくねんの かんじが ひらくよ`);
    return parts.join('。') || 'きょうも いっしょに あそぼう！';
  }

  const levelsEl = h('div', { class: 'levels' });
  const chipsEl = h('div', { class: 'chips' });

  function renderChips(): void {
    clear(chipsEl);
    for (const c of CATEGORIES) {
      const open = cats.includes(c);
      chipsEl.appendChild(h('button', {
        class: `chip ${c === cat ? 'active' : ''} ${open ? '' : 'locked'}`,
        disabled: !open,
        onClick: () => { sfx.tap(); cat = c; localStorage.setItem(KEY_CAT + p.id, String(c)); renderChips(); renderLevels(); },
      }, open ? CATEGORY_LABEL[c] : `🔒 ${CATEGORY_LABEL[c]}`));
    }
  }

  function renderLevels(): void {
    clear(levelsEl);
    for (let lv = 1; lv <= 5; lv++) {
      const locked = lv > maxLv;
      const clears = p.progress.clears[lv] ?? 0;
      const recommended = !locked && lv === maxLv && (lv === 1 ? p.progress.totalPuzzles === 0 : true);
      const dots = lv < 5
        ? h('div', { class: 'dots' }, ...Array.from({ length: CLEARS_TO_UNLOCK }, (_, i) => h('i', { class: i < clears ? 'on' : '' })))
        : h('div', { class: 'dots' }, ...Array.from({ length: L5_CLEARS_PER_STAR }, (_, i) => h('i', { class: i < (p.progress.l5clears % L5_CLEARS_PER_STAR) || star >= 3 ? 'on' : '' })));
      levelsEl.appendChild(h('button', {
        class: `level-btn ${locked ? 'locked' : ''} ${recommended ? 'recommended' : ''}`,
        disabled: locked,
        onClick: () => { sfx.tap(); act.play(cat, lv); },
      },
        recommended ? h('span', { class: 'here' }, p.progress.totalPuzzles === 0 ? 'ここから！' : 'つぎは これ') : null,
        h('span', { class: 'lv' }, 'レベル'),
        h('span', { class: 'n' }, locked ? '🔒' : String(lv)),
        h('span', { class: 'desc' }, lv === 5 ? (star >= 3 ? '8まい' : '7まい') : LEVEL_DESC[lv - 1]),
        lv === 5 && !locked ? h('span', { class: 'stars' }, '★'.repeat(star) + '☆'.repeat(3 - star)) : dots,
      ));
    }
  }
  renderChips(); renderLevels();

  const scoreBtn = h('button', { class: 'btn blue', onClick: () => { sfx.tap(); act.score(cat, 0, 5); } }, '🏅 スコアアタック（レベル1〜5 とおし）');
  const best = bestFor(p.id, cat, 0, 5);

  // パン占いへ（生年月日を POST して結果ページを開く）。新しいタブだと GET に化ける環境があるので同じタブで開く
  const [by, bm, bd] = p.birth.split('-');
  const uranaiForm = h('form', { method: 'POST', action: `${PANURANAI_URL}/diagnose`, style: { display: 'inline' } },
    h('input', { type: 'hidden', name: 'year', value: by }),
    h('input', { type: 'hidden', name: 'month', value: String(Number(bm)) }),
    h('input', { type: 'hidden', name: 'day', value: String(Number(bd)) }),
    h('button', { type: 'submit', class: 'btn ghost small' }, '🔮 きょうの うらない（パンうらないの けっかへ）'),
  );

  clear(root);
  root.appendChild(h('div', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('h1', { class: 'title' }, '🥐 パンしりとり'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn ghost small', onClick: () => { sfx.tap(); act.switchProfile(); } }, h('img', { src: breadImage(p.bread), style: { width: '24px', height: '24px' } }), p.name, ' ▾'),
    ),
    h('div', { class: 'home-hero' },
      ch.el,
      h('div', { class: 'bubble' },
        `${greet}、${p.name}！ ${goalText()}`, h('br'),
        h('span', { class: 'sub' }, `${bread.name}の もうしごと いっしょに かんじを つなげよう。いまは ${gradeLabel(schoolGrade(p.birth))}。`),
      ),
    ),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, '⭐ ', h('span', { class: 'num' }, String(p.progress.stamps)), ' スタンプ'),
      h('div', { class: 'stat' }, '🔥 ', h('span', { class: 'num' }, String(p.progress.streak)), ' にち れんぞく'),
      h('div', { class: 'stat' }, '📖 ', h('span', { class: 'num' }, String(Object.keys(p.progress.collected).length)), ' ことば'),
    ),
    h('h3', { style: { margin: '14px 0 0' } }, 'どの かんじで あそぶ？'),
    h('p', { class: 'sub', style: { margin: '0 0 6px' } }, '🔒は いまの がくねんで レベル3を クリアすると ひらくよ（おうちのひと メニューからも ひらけます）'),
    chipsEl,
    h('h3', { style: { margin: '14px 0 0' } }, 'レベルを えらぼう'),
    h('p', { class: 'sub', style: { margin: '0 0 4px' } }, `${CLEARS_TO_UNLOCK}かい クリアすると つぎの レベルが ひらくよ`),
    levelsEl,
    h('p', { class: 'sub', style: { margin: '14px 0 4px' } }, 'スコアアタックは レベル1から5まで 1もんずつ、じかんを はかって とくてんを きそうよ'),
    h('div', { class: 'home-actions' },
      h('button', { class: `btn ${dailyDone ? 'ghost' : 'pink'}`, onClick: () => { sfx.tap(); act.daily(cat, maxLv); } }, dailyDone ? '☀ きょうの1もん ✓' : '☀ きょうの1もん'),
      scoreBtn,
      h('button', { class: 'btn green', onClick: () => { sfx.tap(); act.zukan(); } }, '📖 ことばずかん'),
    ),
    best ? h('p', { class: 'sub center', style: { margin: '6px 0 0' } }, `スコアアタック さいこうてん（${CATEGORY_LABEL[cat]}）: ${best.score}てん ／ ${fmtTime(best.ms)}`) : null,
    h('div', { class: 'home-footer' },
      h('div', { class: 'row' }, uranaiForm, h('button', { class: 'btn ghost small', onClick: () => { sfx.tap(); openShareModal(); } }, '👫 ともだちに おしえる'),
        isStandalone() ? null : h('button', { class: 'btn ghost small', onClick: () => { sfx.tap(); openInstallModal(); } }, '📲 ホームに 追加')),
      h('button', { class: 'small-link', onClick: () => { sfx.tap(); act.parent(); } }, 'おうちのひと メニュー'),
    ),
  ));

  // 4月の進級を通知（保存はしない: 学年は生年月日から毎回計算）
  void saveProfile;
  return () => ch.destroy();
}
