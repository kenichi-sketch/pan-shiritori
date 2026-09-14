import type { Dictionary } from './data';
import type { Category, LevelConfig, Puzzle } from './types';
import { mulberry32, shuffle, type Rng } from './rng';

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

/**
 * ランダムウォーク＋バックトラックで n 枚の連鎖を1本作る。
 * avoidWords（最近出した熟語）は strict なら使わない、そうでなければ後回しにする。
 */
function findChain(dict: Dictionary, cat: Category, n: number, rng: Rng, avoid: Set<string>, avoidWords: Set<string>, hardAvoid: Set<string>, strict: boolean): string[] | null {
  const limit = scoreLimit(cat);
  const banned = (w: string) => hardAvoid.has(w) || (strict && avoidWords.has(w));
  // 出発点は「使える後続語がある漢字」から順番に試す
  const starts = shuffle(
    dict.kanjiInCategory(cat).filter((k) => dict.successors(k, cat, limit).some((x) => !banned(x.w))),
    rng,
  );
  for (let attempt = 0; attempt < Math.min(300, starts.length); attempt++) {
    const start = starts[attempt];
    const path = [start];
    const used = new Set(path);
    let steps = 0;
    const dfs = (): boolean => {
      if (path.length === n) return true;
      if (++steps > 4000) return false;
      const cur = path[path.length - 1];
      const cands = dict.successors(cur, cat, limit).filter((x) => !used.has(x.w[1]) && !banned(x.w));
      // 語の偏りを防ぐため頻度の重みは弱め。最近出した語は後回し
      const ordered = shuffle(cands, rng)
        .map((c) => ({ c, key: c.score * 0.3 + rng() * 40 + (avoidWords.has(c.w) ? 200 : 0) }))
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

/** そのカテゴリで出題に使える熟語の数（「最近出した語」を覚えておく量の目安に使う） */
export function availableWordCount(dict: Dictionary, cat: Category): number {
  const limit = scoreLimit(cat);
  let n = 0;
  for (const k of dict.kanjiInCategory(cat)) n += dict.successors(k, cat, limit).length;
  return n;
}

/**
 * 出題を1つ作る。
 * avoid: 最近出した連鎖（丸ごと同じ問題を避ける）
 * avoidWords: 最近出した熟語（まず完全に避け、無理なら後回しにして探す）
 * hardAvoid: 今回のセット（スコアアタックの5問など）で既に出た熟語。可能な限り絶対に使わない
 */
export function generatePuzzle(dict: Dictionary, cat: Category, cfg: LevelConfig, seed: number, avoid = new Set<string>(), avoidWords = new Set<string>(), hardAvoid = new Set<string>()): Puzzle {
  const rng = mulberry32(seed);
  let n = cfg.n;
  let answer = findChain(dict, cat, n, rng, avoid, avoidWords, hardAvoid, true);
  if (!answer) answer = findChain(dict, cat, n, rng, avoid, avoidWords, hardAvoid, false);
  // 語数の少ない小1などで見つからなければ、段階的に条件を緩める
  if (!answer && avoid.size) answer = findChain(dict, cat, n, rng, new Set(), avoidWords, hardAvoid, false);
  if (!answer && hardAvoid.size) answer = findChain(dict, cat, n, rng, new Set(), avoidWords, new Set(), false);
  while (!answer && n > 3) { n--; answer = findChain(dict, cat, n, rng, new Set(), avoidWords, new Set(), false); }
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
