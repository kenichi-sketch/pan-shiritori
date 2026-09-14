import type { Dictionary } from './data';
import type { Category, LevelConfig, Puzzle } from './types';
import { mulberry32, pick, shuffle, type Rng } from './rng';

export function levelConfig(level: number, star = 1): LevelConfig {
  switch (level) {
    case 1: return { level, star: 1, n: 3, dummies: 0, fixedFirst: true, furigana: true };
    case 2: return { level, star: 1, n: 4, dummies: 0, fixedFirst: true, furigana: true };
    case 3: return { level, star: 1, n: 5, dummies: 0, fixedFirst: true, furigana: true };
    case 4: return { level, star: 1, n: 6, dummies: 1, fixedFirst: true, furigana: true };
    default:
      if (star >= 3) return { level: 5, star: 3, n: 8, dummies: 4, fixedFirst: false, furigana: false };
      if (star === 2) return { level: 5, star: 2, n: 7, dummies: 3, fixedFirst: false, furigana: true };
      return { level: 5, star: 1, n: 7, dummies: 3, fixedFirst: true, furigana: true };
  }
}

/** 低学年カテゴリは語数が少ないので全語、上の学年は一般的な語に絞って出題（判定は全語で行う） */
function scoreLimit(cat: Category): number {
  return cat <= 2 ? 99 : cat <= 4 ? 48 : 40;
}

/** ランダムウォーク＋バックトラックで n 枚の連鎖を1本作る */
function findChain(dict: Dictionary, cat: Category, n: number, rng: Rng, avoid: Set<string>): string[] | null {
  const kanji = dict.kanjiInCategory(cat);
  const limit = scoreLimit(cat);
  for (let attempt = 0; attempt < 300; attempt++) {
    const start = pick(kanji, rng);
    if (dict.successors(start, cat, limit).length === 0) continue;
    const path = [start];
    const used = new Set(path);
    let steps = 0;
    const dfs = (): boolean => {
      if (path.length === n) return true;
      if (++steps > 4000) return false;
      const cur = path[path.length - 1];
      const cands = dict.successors(cur, cat, limit).filter((x) => !used.has(x.w[1]));
      // 一般的な語をやや優先しつつランダムに
      const ordered = shuffle(cands, rng)
        .map((c) => ({ c, key: c.score + rng() * 40 }))
        .sort((a, b) => a.key - b.key)
        .map((x) => x.c);
      for (const c of ordered) {
        const nx = c.w[1];
        path.push(nx); used.add(nx);
        if (dfs()) return true;
        path.pop(); used.delete(nx);
      }
      return false;
    };
    if (dfs() && !avoid.has(path.join(''))) return path;
  }
  return null;
}

export function generatePuzzle(dict: Dictionary, cat: Category, cfg: LevelConfig, seed: number, avoid = new Set<string>()): Puzzle {
  const rng = mulberry32(seed);
  let n = cfg.n;
  let answer = findChain(dict, cat, n, rng, avoid);
  while (!answer && n > 3) { n--; answer = findChain(dict, cat, n, rng, avoid); }
  if (!answer) throw new Error('puzzle generation failed');

  const used = new Set(answer);
  const pool = shuffle(dict.kanjiInCategory(cat).filter((c) => !used.has(c)), rng);
  const dummies = pool.slice(0, cfg.dummies);
  const first = cfg.fixedFirst ? answer[0] : null;
  const rest = cfg.fixedFirst ? answer.slice(1) : answer.slice();
  const tiles = shuffle([...rest, ...dummies], rng);
  return { cat, cfg: { ...cfg, n: answer.length }, answer, tiles, first, seed };
}

export interface CheckResult {
  ok: boolean;
  /** 各つなぎ目（i と i+1）が熟語か */
  joints: boolean[];
}

export function checkChain(dict: Dictionary, chain: string[]): CheckResult {
  const joints: boolean[] = [];
  for (let i = 0; i + 1 < chain.length; i++) joints.push(dict.isWord(chain[i], chain[i + 1]));
  return { ok: joints.every(Boolean), joints };
}

/**
 * ヒント。並べた部分が正しければ「次に置けて最後まで完成できるタイル」を返す。
 * 途中が間違っていれば、そこから外すよう位置を返す。
 */
export function hint(dict: Dictionary, placed: string[], remaining: string[], n: number): { tile?: string; removeFrom?: number } {
  for (let i = 0; i + 1 < placed.length; i++) {
    if (!dict.isWord(placed[i], placed[i + 1])) return { removeFrom: i + 1 };
  }
  const need = n - placed.length;
  if (need <= 0) return {};
  const canFinish = (last: string, left: string[], depth: number): boolean => {
    if (depth === 0) return true;
    for (let i = 0; i < left.length; i++) {
      if (dict.isWord(last, left[i])) {
        if (canFinish(left[i], left.slice(0, i).concat(left.slice(i + 1)), depth - 1)) return true;
      }
    }
    return false;
  };
  if (placed.length === 0) {
    for (const t of remaining) {
      if (canFinish(t, remaining.filter((x) => x !== t), need - 1)) return { tile: t };
    }
    return {};
  }
  const last = placed[placed.length - 1];
  for (const t of remaining) {
    if (dict.isWord(last, t) && canFinish(t, remaining.filter((x) => x !== t), need - 1)) return { tile: t };
  }
  return { removeFrom: Math.max(0, placed.length - 1) };
}
