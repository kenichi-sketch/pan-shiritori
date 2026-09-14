import type { Category } from './types';

/** スコアアタックの記録 */
export interface RankEntry {
  profileId: string;
  name: string;
  bread: string;
  cat: Category;
  level: number;
  count: number;   // 5 or 10
  score: number;
  ms: number;
  hints: number;
  date: string;    // ISO
}

const KEY = 'panshiri.ranking.v2';

/** 1問あたりの得点。熟語1つ10点 + 速さボーナス + ヒントなし10点（ヒントを使うと1回ごとに5点減点） */
export const POINTS_PER_WORD = 10;
export const NO_HINT_BONUS = 10;
export const PAR_SEC_PER_WORD = 8;      // この秒数×熟語数より速ければボーナス
export const BONUS_PER_SEC = 2;
export const MAX_TIME_BONUS_PER_WORD = 6; // 速さボーナスの上限（熟語1つあたり）

export const HINT_PENALTY = 5;           // ヒント1回ごとの減点（2026-09-15 有澤さん提案）

/** hints＝その問題でヒントを押した回数。0回なら＋10、1回以上は1回ごとに−5（その問題の得点は0を下回らない） */
export function puzzleScore(wordCount: number, ms: number, hints: number): { total: number; base: number; timeBonus: number; hintBonus: number } {
  const base = wordCount * POINTS_PER_WORD;
  const par = wordCount * PAR_SEC_PER_WORD;
  const saved = Math.max(0, par - ms / 1000);
  const timeBonus = Math.min(wordCount * MAX_TIME_BONUS_PER_WORD, Math.round(saved * BONUS_PER_SEC));
  const hintBonus = hints <= 0 ? NO_HINT_BONUS : -Math.min(hints * HINT_PENALTY, base + timeBonus);
  return { total: base + timeBonus + hintBonus, base, timeBonus, hintBonus };
}

export function loadRanking(): RankEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as RankEntry[]; } catch { return []; }
}
function saveRanking(list: RankEntry[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function byScore(a: RankEntry, b: RankEntry): number {
  return b.score - a.score || a.ms - b.ms;
}

/** 同じ条件（カテゴリ・レベル・問数）の記録を高得点順に */
export function rankingFor(cat: Category, level: number, count: number): RankEntry[] {
  return loadRanking().filter((e) => e.cat === cat && e.level === level && e.count === count).sort(byScore);
}

/** 記録を追加し、その条件での順位（1始まり）を返す */
export function addRecord(e: RankEntry): number {
  const list = loadRanking();
  list.push(e);
  const grouped = new Map<string, RankEntry[]>();
  for (const x of list) {
    const k = `${x.cat}-${x.level}-${x.count}`;
    const g = grouped.get(k) ?? []; g.push(x); grouped.set(k, g);
  }
  const trimmed: RankEntry[] = [];
  for (const g of grouped.values()) trimmed.push(...g.sort(byScore).slice(0, 100));
  saveRanking(trimmed);
  const same = rankingFor(e.cat, e.level, e.count);
  return same.findIndex((x) => x.date === e.date && x.profileId === e.profileId) + 1;
}

/** 本人の最高記録 */
export function bestFor(profileId: string, cat: Category, level: number, count: number): RankEntry | null {
  return rankingFor(cat, level, count).find((e) => e.profileId === profileId) ?? null;
}

/** 本人の全条件の最高記録一覧 */
export function bestsFor(profileId: string): RankEntry[] {
  const seen = new Set<string>();
  return loadRanking().filter((e) => e.profileId === profileId).sort(byScore).filter((e) => {
    const k = `${e.cat}-${e.level}-${e.count}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

export function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const tenth = Math.floor((ms % 1000) / 100);
  return m > 0 ? `${m}ふん${String(sec).padStart(2, '0')}.${tenth}びょう` : `${sec}.${tenth}びょう`;
}
