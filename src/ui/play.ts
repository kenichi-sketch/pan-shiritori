import type { Dictionary } from '../data';
import { checkChain, generatePuzzle, hint as findHint, levelConfig } from '../game';
import { level5Star, recordClear, reportWord, saveProfile, schoolGrade, todayStr, touchPlay } from '../profile';
import { hashString, randomSeed } from '../rng';
import { addRecord, bestFor, fmtTime, puzzleScore, rankingFor } from '../ranking';
import { sfx, speak } from '../audio';
import { BREADS } from '../chars';
import type { Category, Profile, Puzzle, WordInfo } from '../types';
import { CATEGORY_LABEL } from '../types';
import { Character, confetti } from './character';
import { clear, h, wait } from './dom';
import { track } from '../analytics';

export type PlayMode = 'normal' | 'daily' | 'score';

export interface PlayOptions {
  dict: Dictionary;
  profile: Profile;
  cat: Category;
  level: number;
  mode: PlayMode;
  count?: number; // score モードの問数
  onExit: () => void;
}

const recentKeys = new Set<string>();

export function mountPlay(root: HTMLElement, opt: PlayOptions): () => void {
  const { dict, profile } = opt;
  const star = level5Star(profile);
  /** スコアモードはレベル1→5を1問ずつ。それ以外は選んだレベル */
  const SCORE_LEVELS = [1, 2, 3, 4, 5];
  const totalCount = opt.mode === 'score' ? SCORE_LEVELS.length : 1;
  let currentLevel = opt.mode === 'score' ? SCORE_LEVELS[0] : opt.level;
  let cfg = levelConfig(currentLevel, currentLevel === 5 ? star : 1);
  let showFurigana = cfg.furigana && profile.settings.furigana;

  let puzzle!: Puzzle;
  let placed: string[] = [];
  let tray: { k: string; used: boolean; el: HTMLElement }[] = [];
  let usedHint = false;
  let solvedCount = 0;
  let scoreTotal = 0;
  let scoreHints = 0;
  let puzzleStart = 0;
  let elapsedBefore = 0;   // 前の問題までの合計
  let timerId: number | null = null;
  let finished = false;

  const character = new Character(profile.bread, 120);
  const bubble = h('div', { class: 'bubble' });
  const chainEl = h('div', { class: 'chain' });
  const trayEl = h('div', { class: 'tray' });
  const progressBadge = h('span', { class: 'badge' });
  const levelBadge = h('span', { class: 'badge' });
  const timerBadge = h('span', { class: 'badge', style: { display: opt.mode === 'score' ? '' : 'none' } });
  const hintBtn = h('button', { class: 'btn yellow small', onClick: () => doHint() }, '💡 ヒント');
  const undoBtn = h('button', { class: 'btn ghost small', onClick: () => undo() }, '↩ もどす');

  const screen = h('div', { class: 'screen play' },
    h('div', { class: 'play-head' },
      h('button', { class: 'icon-btn', onClick: () => exit(), 'aria-label': 'もどる' }, '←'),
      h('span', { class: 'badge' }, CATEGORY_LABEL[opt.cat]),
      levelBadge, progressBadge, timerBadge,
      h('span', { class: 'grow' }),
      opt.mode === 'daily' ? h('span', { class: 'badge' }, '☀ きょうの1もん') : null,
    ),
    chainEl,
    trayEl,
    h('div', { class: 'play-controls' }, undoBtn, hintBtn),
    h('div', { class: 'play-bottom' }, character.el, bubble),
  );
  clear(root); root.appendChild(screen);
  touchPlay(profile);

  function say(text: string, word?: WordInfo): void {
    clear(bubble);
    bubble.appendChild(document.createTextNode(text));
    if (word) bubble.appendChild(reportButton(word, '🚩 へん？'));
  }

  /** 「へんなことば」申告ボタン。押すと送信して ✓ に変わる */
  function reportButton(w: WordInfo, label = '🚩 へんなことば？'): HTMLElement {
    return h('button', { class: 'flag', title: 'おかしいと おもったら おしてね', onClick: async (e: Event) => {
      e.stopPropagation();
      const btn = e.currentTarget as HTMLButtonElement;
      btn.disabled = true; btn.textContent = '…';
      await reportWord({ word: w.w, reading: w.r, cat: opt.cat, grade: schoolGrade(profile.birth) });
      btn.textContent = '✓ つたえたよ';
      track('report_word', { word: w.w, cat: opt.cat });
    } }, label);
  }

  function newPuzzle(): void {
    if (opt.mode === 'score') currentLevel = SCORE_LEVELS[Math.min(solvedCount, SCORE_LEVELS.length - 1)];
    cfg = levelConfig(currentLevel, currentLevel === 5 ? star : 1);
    showFurigana = cfg.furigana && profile.settings.furigana;
    levelBadge.textContent = `レベル${currentLevel}${currentLevel === 5 ? ' ' + '★'.repeat(star) : ''}`;
    const seed = opt.mode === 'daily' ? hashString(`${todayStr()}|${opt.cat}|${opt.level}|${profile.birth}`) : randomSeed();
    puzzle = generatePuzzle(dict, opt.cat, cfg, seed, recentKeys);
    recentKeys.add(puzzle.answer.join(''));
    if (recentKeys.size > 200) recentKeys.delete(recentKeys.values().next().value as string);
    placed = puzzle.first ? [puzzle.first] : [];
    usedHint = false;
    puzzleStart = performance.now();
    renderTray();
    renderChain();
    progressBadge.textContent = opt.mode === 'score' ? `${solvedCount + 1} / ${totalCount}もんめ` : `${puzzle.cfg.n}まい`;
    const n = puzzle.cfg.n;
    if (puzzle.first) say(`「${puzzle.first}」から はじめて、${n}まい つなげよう！`);
    else say(`すきな 1まいから はじめて、${n}まい つなげよう！`);
    character.mood('wave', 1200);
  }

  /** 想定解の熟語に沿った、タイルごとの読み（ダミーは音読み） */
  let tileReading = new Map<string, string>();
  function computeTileReadings(): void {
    tileReading = new Map();
    const a = puzzle.answer;
    for (let i = 0; i < a.length; i++) {
      const r = (i > 0 ? dict.readingIn(a[i - 1], a[i]) : null)
        ?? (i + 1 < a.length ? dict.readingBefore(a[i], a[i + 1]) : null)
        ?? dict.reading(a[i]);
      tileReading.set(a[i], r);
    }
    for (const k of puzzle.tiles) if (!tileReading.has(k)) tileReading.set(k, dict.reading(k));
  }

  function tileEl(k: string, reading?: string): HTMLElement {
    return h('div', { class: 'tile' },
      h('span', { class: 'k' }, k),
      h('span', { class: 'r' }, showFurigana ? (reading ?? tileReading.get(k) ?? dict.reading(k)) : ''),
    );
  }

  function renderTray(): void {
    clear(trayEl);
    computeTileReadings();
    tray = puzzle.tiles.map((k) => {
      const el = tileEl(k);
      el.addEventListener('click', () => onTrayTap(k));
      trayEl.appendChild(el);
      return { k, used: false, el };
    });
  }

  function renderChain(): void {
    clear(chainEl);
    const n = puzzle.cfg.n;
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        const ok = i < placed.length;
        const joint = h('div', { class: `joint ${ok ? 'ok' : ''}` }, ok ? '▶' : '·');
        if (ok) {
          const w = dict.word(placed[i - 1], placed[i]);
          if (w) joint.appendChild(h('span', { class: 'word-read' }, w.r));
        }
        chainEl.appendChild(joint);
      }
      const isFixed = i === 0 && !!puzzle.first;
      const slot = h('div', { class: `slot ${i < placed.length ? 'filled' : ''} ${isFixed ? 'fixed' : ''} ${i === placed.length ? 'next' : ''}` });
      if (i < placed.length) {
        // 実際にできた熟語での読みを優先
        const actual = (i > 0 ? dict.readingIn(placed[i - 1], placed[i]) : null)
          ?? (i + 1 < placed.length ? dict.readingBefore(placed[i], placed[i + 1]) : null)
          ?? undefined;
        const t = tileEl(placed[i], actual); t.classList.add('in-slot', 'pop');
        if (!isFixed) t.addEventListener('click', () => removeFrom(i));
        slot.appendChild(t);
      }
      chainEl.appendChild(slot);
    }
    undoBtn.disabled = placed.length <= (puzzle.first ? 1 : 0);
  }

  function onTrayTap(k: string): void {
    if (finished) return;
    const t = tray.find((x) => x.k === k && !x.used);
    if (!t) return;
    const last = placed[placed.length - 1];
    if (last !== undefined && !dict.isWord(last, k)) {
      sfx.wrong();
      character.mood('sad', 1000);
      const slots = chainEl.querySelectorAll('.slot');
      const next = slots[placed.length] as HTMLElement | undefined;
      if (next) { next.classList.add('bad'); window.setTimeout(() => next.classList.remove('bad'), 450); }
      t.el.classList.add('pop'); window.setTimeout(() => t.el.classList.remove('pop'), 300);
      say(`「${last}${k}」は ことばに ならないみたい。ほかのを ためしてみよう`);
      return;
    }
    t.used = true; t.el.classList.add('used');
    placed.push(k);
    sfx.place();
    renderChain();
    if (last !== undefined) {
      const w = dict.word(last, k);
      if (w) { say(`「${w.w}」（${w.r}）できた！`, w); speak(w.r); character.mood('happy', 800); }
    } else {
      say(`「${k}」から スタート！つぎは？`);
    }
    if (placed.length === puzzle.cfg.n) void onClear();
  }

  function removeFrom(i: number): void {
    if (finished) return;
    const minIdx = puzzle.first ? 1 : 0;
    if (i < minIdx) return;
    const removed = placed.splice(i);
    for (const k of removed) {
      const t = tray.find((x) => x.k === k && x.used);
      if (t) { t.used = false; t.el.classList.remove('used'); }
    }
    sfx.back();
    renderChain();
    say('もどしたよ。もういちど かんがえてみよう');
  }

  function undo(): void {
    if (placed.length > (puzzle.first ? 1 : 0)) removeFrom(placed.length - 1);
  }

  function doHint(): void {
    if (finished) return;
    const remaining = tray.filter((t) => !t.used).map((t) => t.k);
    const r = findHint(dict, placed, remaining, puzzle.cfg.n);
    usedHint = true;
    sfx.hint();
    character.mood('think', 1500);
    if (r.tile) {
      const t = tray.find((x) => x.k === r.tile && !x.used);
      if (t) { t.el.classList.add('hint'); window.setTimeout(() => t.el.classList.remove('hint'), 2500); }
      say('ひかっている タイルを おしてみよう！');
    } else if (r.removeFrom !== undefined && r.removeFrom < placed.length) {
      const slots = chainEl.querySelectorAll('.slot');
      const s = slots[r.removeFrom] as HTMLElement | undefined;
      if (s) { s.classList.add('bad'); window.setTimeout(() => s.classList.remove('bad'), 800); }
      say('このさきが つづかないよ。1まい もどしてみよう');
    } else {
      say('もう すこしで できるよ！');
    }
  }

  function wordsInChain(): WordInfo[] {
    const res: WordInfo[] = [];
    for (let i = 0; i + 1 < placed.length; i++) {
      const w = dict.word(placed[i], placed[i + 1]);
      if (w) res.push(w);
    }
    return res;
  }

  async function onClear(): Promise<void> {
    const chk = checkChain(dict, placed);
    if (!chk.ok) return; // 起こらないはず
    finished = true;
    const ms = performance.now() - puzzleStart;
    elapsedBefore += ms;
    const words = wordsInChain();
    sfx.clear();
    character.mood('dance', 0);
    say('できた！すごい！');
    const result = recordClear(profile, opt.cat, currentLevel, words.map((w) => w.w), usedHint);
    track('puzzle_clear', { mode: opt.mode, cat: opt.cat, level: currentLevel, hint: usedHint, ms: Math.round(ms) });
    if (opt.mode === 'daily') { profile.progress.dailyDone = todayStr(); saveProfile(profile); }
    solvedCount++;
    let ps: ReturnType<typeof puzzleScore> | null = null;
    if (opt.mode === 'score') {
      ps = puzzleScore(words.length, ms, usedHint);
      scoreTotal += ps.total;
      if (usedHint) scoreHints++;
    }
    await wait(500);
    showClearModal(words, result, ps, ms);
  }

  function showClearModal(words: WordInfo[], result: ReturnType<typeof recordClear>, ps: ReturnType<typeof puzzleScore> | null, ms: number): void {
    const isLast = opt.mode !== 'score' || solvedCount >= totalCount;
    const list = h('div', { class: 'word-list' });
    for (const w of words) {
      const item = h('div', { class: 'word-item', onClick: () => speak(w.r) },
        h('span', { class: 'w' }, w.w),
        h('div', null, h('div', { class: 'rd' }, w.r), w.m ? h('div', { class: 'mn' }, w.m) : null),
        result.newWords.includes(w.w) ? h('span', { class: 'new' }, 'NEW') : null,
        reportButton(w),
      );
      list.appendChild(item);
    }
    const notices: HTMLElement[] = [];
    if (result.unlockedLevel) notices.push(h('div', { class: 'notice' }, `🎉 レベル${result.unlockedLevel}が あそべるようになった！`));
    if (result.unlockedCat) notices.push(h('div', { class: 'notice' }, `🎉 「${CATEGORY_LABEL[result.unlockedCat]}」の かんじが あそべるようになった！`));
    if (result.starUp) notices.push(h('div', { class: 'notice' }, `⭐ レベル5の ほしが ふえた！`));
    if (notices.length) window.setTimeout(() => sfx.unlock(), 600);

    const modalChar = new Character(profile.bread, 150);
    modalChar.mood('dance', 0);
    const modal = h('div', { class: 'modal' },
      h('h2', null, isLast && opt.mode === 'score' ? 'ぜんぶ できた！' : 'できた！'),
      h('div', { class: 'row', style: { justifyContent: 'center', gap: '16px' } },
        modalChar.el,
        h('div', null,
          h('div', { class: 'stat' }, '⭐ スタンプ ', h('span', { class: 'num' }, String(profile.progress.stamps))),
          profile.progress.streak > 1 ? h('div', { class: 'stat', style: { marginTop: '6px' } }, '🔥 ', h('span', { class: 'num' }, String(profile.progress.streak)), ' にち れんぞく') : null,
          ps ? h('div', { class: 'stat', style: { marginTop: '6px' } }, '🏅 ', h('span', { class: 'num' }, `+${ps.total}`), ' てん') : null,
        ),
      ),
      ps ? h('div', { class: 'sub center' }, `ことば${words.length}つ ${ps.base}てん ＋ はやさ ${ps.timeBonus}てん ＋ ヒントなし ${ps.hintBonus}てん（${fmtTime(ms)}）`) : null,
      list,
      ...notices,
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } },
        isLast
          ? h('button', { class: 'btn ghost', onClick: () => { overlay.remove(); modalChar.destroy(); exit(); } }, 'おわる')
          : null,
        opt.mode === 'daily'
          ? h('button', { class: 'btn big green', onClick: () => { overlay.remove(); modalChar.destroy(); opt.mode = 'normal'; finished = false; newPuzzle(); } }, 'もっと あそぶ')
          : isLast && opt.mode === 'score'
            ? h('button', { class: 'btn big green', onClick: () => { overlay.remove(); modalChar.destroy(); showScoreResult(); } }, 'けっかを みる')
            : h('button', { class: 'btn big green', onClick: () => { overlay.remove(); modalChar.destroy(); finished = false; newPuzzle(); } }, 'つぎの もんだい ▶'),
      ),
    );
    const overlay = h('div', { class: 'overlay' }, modal);
    document.body.appendChild(overlay);
    confetti(modal, 36);
    // 読み上げ（順番に）
    void (async () => {
      await wait(300);
      for (const w of words) { speak(w.r); await wait(1100); }
    })();
  }

  function showScoreResult(): void {
    stopTimer();
    const entry = {
      profileId: profile.id, name: profile.name, bread: profile.bread,
      cat: opt.cat, level: 0, count: totalCount,
      score: scoreTotal, ms: elapsedBefore, hints: scoreHints, date: new Date().toISOString(),
    };
    const prevBest = bestFor(profile.id, opt.cat, 0, totalCount);
    const isBest = !prevBest || scoreTotal > prevBest.score;
    const rank = addRecord(entry);
    track('score_attack_done', { cat: opt.cat, score: scoreTotal, ms: Math.round(elapsedBefore), best: isBest });
    const ranking = rankingFor(opt.cat, 0, totalCount).slice(0, 10);
    const modalChar = new Character(profile.bread, 150);
    modalChar.mood(isBest ? 'dance' : 'happy', 0);
    const table = h('table', { style: { width: '100%', background: '#fff', borderRadius: '14px', overflow: 'hidden' } },
      ...ranking.map((r, i) => h('tr', { style: { background: r.date === entry.date ? '#fff3dc' : '' } },
        h('td', { style: { padding: '6px 10px', fontWeight: '900', width: '2.5em' } }, `${i + 1}い`),
        h('td', { style: { padding: '6px' } }, h('img', { src: `${import.meta.env.BASE_URL}chars/${r.bread}.webp`, style: { width: '32px', height: '32px', verticalAlign: 'middle' } })),
        h('td', { style: { padding: '6px 10px', fontWeight: '700' } }, r.name),
        h('td', { style: { padding: '6px 10px', textAlign: 'right', fontWeight: '900', color: '#e76f51' } }, `${r.score}てん`),
        h('td', { style: { padding: '6px 10px', textAlign: 'right', color: '#8a7560', fontSize: '0.85rem' } }, fmtTime(r.ms)),
      )),
    );
    const modal = h('div', { class: 'modal' },
      h('h2', null, isBest ? '🏆 さいこうきろく！' : 'けっか'),
      h('div', { class: 'row', style: { justifyContent: 'center', gap: '16px' } },
        modalChar.el,
        h('div', null,
          h('div', { class: 'stat' }, '🏅 ', h('span', { class: 'num', style: { fontSize: '2rem' } }, String(scoreTotal)), ' てん'),
          h('div', { class: 'stat', style: { marginTop: '6px' } }, '⏱ ', fmtTime(elapsedBefore)),
          h('div', { class: 'stat', style: { marginTop: '6px' } }, `${CATEGORY_LABEL[opt.cat]} レベル1〜5 とおし`),
          prevBest && !isBest ? h('div', { class: 'sub', style: { marginTop: '6px' } }, `いまの さいこう: ${prevBest.score}てん`) : null,
          h('div', { class: 'sub', style: { marginTop: '6px' } }, `このたんまつで ${rank}い`),
        ),
      ),
      h('h3', { style: { margin: '12px 0 6px', textAlign: 'center' } }, 'ランキング'),
      table,
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '14px' } },
        h('button', { class: 'btn ghost', onClick: () => { overlay.remove(); modalChar.destroy(); exit(); } }, 'おわる'),
        h('button', { class: 'btn big green', onClick: () => { overlay.remove(); modalChar.destroy(); restartScore(); } }, 'もういっかい'),
      ),
    );
    const overlay = h('div', { class: 'overlay' }, modal);
    document.body.appendChild(overlay);
    if (isBest) { confetti(modal, 50); sfx.unlock(); }
  }

  function restartScore(): void {
    solvedCount = 0; scoreTotal = 0; scoreHints = 0; elapsedBefore = 0; finished = false;
    startTimer();
    newPuzzle();
  }

  function startTimer(): void {
    stopTimer();
    timerId = window.setInterval(() => {
      if (finished) return;
      const ms = elapsedBefore + (performance.now() - puzzleStart);
      timerBadge.textContent = `⏱ ${fmtTime(ms)}`;
    }, 100);
  }
  function stopTimer(): void {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  function exit(): void {
    stopTimer();
    character.destroy();
    opt.onExit();
  }

  newPuzzle();
  if (opt.mode === 'score') startTimer();
  return () => { stopTimer(); character.destroy(); };
}

export function breadName(no: string): string {
  return BREADS[no]?.name ?? '';
}
