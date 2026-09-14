import type { AppSettings, Category, Profile, Progress, Report } from './types';
import { CATEGORIES } from './types';
import { breadFor } from './chars';

const KEY_PROFILES = 'panshiri.profiles.v1';
const KEY_CURRENT = 'panshiri.current.v1';
const KEY_SETTINGS = 'panshiri.settings.v1';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 容量不足などは無視 */ }
}

export function todayStr(d = new Date()): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * 学年を返す。1..6 = 小1〜小6、7..9 = 中1〜中3。入学前は 0、卒業後は 10。
 * 4月2日〜翌年4月1日生まれが同学年。年度は4月始まり。
 */
export function schoolGrade(birth: string, today = new Date()): number {
  const [by, bm, bd] = birth.split('-').map(Number);
  const fy = today.getMonth() + 1 >= 4 ? today.getFullYear() : today.getFullYear() - 1;
  const entryYear = bm > 4 || (bm === 4 && bd >= 2) ? by + 7 : by + 6;
  return fy - entryYear + 1;
}

export function gradeLabel(g: number): string {
  if (g <= 0) return 'にゅうがくまえ';
  if (g <= 6) return `しょうがく${g}ねんせい`;
  if (g <= 9) return `ちゅうがく${g - 6}ねんせい`;
  return 'ちゅうがくそつぎょう';
}

/** 学年 → 初期カテゴリ */
export function categoryForGrade(g: number): Category {
  if (g <= 1) return 1;
  if (g <= 6) return g as Category;
  return 8;
}

export function nextCategory(c: Category): Category | null {
  const i = CATEGORIES.indexOf(c);
  return i >= 0 && i + 1 < CATEGORIES.length ? CATEGORIES[i + 1] : null;
}

export function emptyProgress(): Progress {
  return { clears: {}, catClears: {}, l5clears: 0, stamps: 0, streak: 0, lastPlay: null, dailyDone: null, collected: {}, hintsUsed: 0, totalPuzzles: 0 };
}

export function createProfile(name: string, birth: string): Profile {
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    birth,
    bread: breadFor(birth).no,
    manualCap: null,
    progress: emptyProgress(),
    settings: { furigana: true, sound: true, speech: true },
    createdAt: new Date().toISOString(),
  };
}

export function listProfiles(): Profile[] {
  return load<Profile[]>(KEY_PROFILES, []);
}
export function saveProfile(p: Profile): void {
  const all = listProfiles();
  const i = all.findIndex((x) => x.id === p.id);
  if (i >= 0) all[i] = p; else all.push(p);
  save(KEY_PROFILES, all);
}
export function deleteProfile(id: string): void {
  save(KEY_PROFILES, listProfiles().filter((x) => x.id !== id));
  if (currentProfileId() === id) save(KEY_CURRENT, null);
}
export function currentProfileId(): string | null {
  return load<string | null>(KEY_CURRENT, null);
}
export function setCurrentProfile(id: string | null): void {
  save(KEY_CURRENT, id);
}
export function currentProfile(): Profile | null {
  const id = currentProfileId();
  return id ? listProfiles().find((p) => p.id === id) ?? null : null;
}

/** 自動で開いているカテゴリの上限（本人の学年 + レベル3クリアで次へ） */
export function autoCap(p: Profile): Category {
  let cap = categoryForGrade(schoolGrade(p.birth));
  for (const c of CATEGORIES) {
    if (c > cap) break;
    if ((p.progress.catClears[c]?.[3] ?? 0) >= 1) {
      const nx = nextCategory(c);
      if (nx && nx > cap) cap = nx;
    }
  }
  return cap;
}
export function effectiveCap(p: Profile): Category {
  const a = autoCap(p);
  return p.manualCap && p.manualCap > a ? p.manualCap : a;
}
export function availableCategories(p: Profile): Category[] {
  const cap = effectiveCap(p);
  return CATEGORIES.filter((c) => c <= cap);
}

export const CLEARS_TO_UNLOCK = 3;
export const L5_CLEARS_PER_STAR = 5;

export function maxUnlockedLevel(p: Profile): number {
  let lv = 1;
  while (lv < 5 && (p.progress.clears[lv] ?? 0) >= CLEARS_TO_UNLOCK) lv++;
  return lv;
}
export function level5Star(p: Profile): number {
  return Math.min(3, Math.floor(p.progress.l5clears / L5_CLEARS_PER_STAR) + 1);
}

/** クリアを記録し、新しく開いたもの・集めた語を返す */
export function recordClear(p: Profile, cat: Category, level: number, words: string[], usedHint: boolean): { newWords: string[]; unlockedLevel: number | null; unlockedCat: Category | null; starUp: boolean } {
  const pr = p.progress;
  const beforeLevel = maxUnlockedLevel(p), beforeCap = autoCap(p), beforeStar = level5Star(p);
  pr.clears[level] = (pr.clears[level] ?? 0) + 1;
  pr.catClears[cat] = pr.catClears[cat] ?? {};
  pr.catClears[cat][level] = (pr.catClears[cat][level] ?? 0) + 1;
  if (level === 5) pr.l5clears++;
  pr.stamps += 1;
  pr.totalPuzzles += 1;
  if (usedHint) pr.hintsUsed += 1;
  const today = todayStr();
  if (pr.lastPlay !== today) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    pr.streak = pr.lastPlay === todayStr(y) ? pr.streak + 1 : 1;
    pr.lastPlay = today;
  }
  const newWords: string[] = [];
  for (const w of words) {
    if (!pr.collected[w]) { pr.collected[w] = today; newWords.push(w); }
  }
  saveProfile(p);
  const afterLevel = maxUnlockedLevel(p), afterCap = autoCap(p), afterStar = level5Star(p);
  return {
    newWords,
    unlockedLevel: afterLevel > beforeLevel ? afterLevel : null,
    unlockedCat: afterCap > beforeCap ? afterCap : null,
    starUp: afterStar > beforeStar,
  };
}

export function touchPlay(p: Profile): void {
  const today = todayStr();
  if (p.progress.lastPlay !== today) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    p.progress.streak = p.progress.lastPlay === todayStr(y) ? p.progress.streak + 1 : 1;
    p.progress.lastPlay = today;
    saveProfile(p);
  }
}

// ---- アプリ全体設定（報告先URLなど） ----
export function loadSettings(): AppSettings {
  return load<AppSettings>(KEY_SETTINGS, { reportUrl: '', reports: [] });
}
export function saveSettings(s: AppSettings): void {
  save(KEY_SETTINGS, s);
}

/** 「へんなことば」報告。GAS の URL があれば送信、なければ端末内に保存 */
export async function reportWord(r: Omit<Report, 'sent' | 'at'>): Promise<boolean> {
  const s = loadSettings();
  const rep: Report = { ...r, at: new Date().toISOString(), sent: false };
  if (s.reportUrl) {
    try {
      await fetch(s.reportUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(rep) });
      rep.sent = true;
    } catch { /* オフラインなど */ }
  }
  s.reports.unshift(rep);
  s.reports = s.reports.slice(0, 200);
  saveSettings(s);
  return rep.sent;
}
