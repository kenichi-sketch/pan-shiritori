/** 辞書データ（public/data/dict.json） */
export interface Dict {
  /** 漢字 → [学年(1-6,8), 訓読み, 音読み] */
  kanji: Record<string, [number, string, string]>;
  /** [熟語, 読み, 学年, 子ども向け度(1-3), 頻度スコア(小さいほど一般的), 意味] */
  words: [string, string, number, number, number, string][];
}

export interface WordInfo {
  w: string;
  r: string;
  g: number;
  k: number;
  score: number;
  m: string;
}

/** カテゴリ = 出題漢字の上限学年。1..6 = 小1〜小6まで, 8 = 中3まで */
export type Category = 1 | 2 | 3 | 4 | 5 | 6 | 8;
export const CATEGORIES: Category[] = [1, 2, 3, 4, 5, 6, 8];
export const CATEGORY_LABEL: Record<Category, string> = {
  1: 'しょう1', 2: 'しょう2', 3: 'しょう3', 4: 'しょう4', 5: 'しょう5', 6: 'しょう6', 8: 'ちゅうがく',
};
export const CATEGORY_LABEL_KANJI: Record<Category, string> = {
  1: '小1まで', 2: '小2まで', 3: '小3まで', 4: '小4まで', 5: '小5まで', 6: '小6まで', 8: '中3まで',
};

export interface LevelConfig {
  level: number;      // 1-5
  star: number;       // レベル5のみ 1-3、それ以外は 1
  n: number;          // つなぐ枚数
  dummies: number;    // ダミー枚数
  fixedFirst: boolean;
  furigana: boolean;  // タイルのふりがな表示
}

export interface Puzzle {
  cat: Category;
  cfg: LevelConfig;
  /** 想定解（1本）。判定は辞書ベースなので別解も正解 */
  answer: string[];
  /** 表示タイル（先頭固定の場合は answer[0] を含まない） */
  tiles: string[];
  first: string | null;
  seed: number;
}

export interface Profile {
  id: string;
  name: string;
  birth: string;              // YYYY-MM-DD
  bread: string;              // 001..033
  manualCap: Category | null; // 親が設定した上限（null なら自動）
  progress: Progress;
  settings: { furigana: boolean; sound: boolean; speech: boolean };
  createdAt: string;
}

export interface Progress {
  clears: Record<number, number>;                    // level → クリア回数
  catClears: Record<number, Record<number, number>>; // cat → level → 回数
  l5clears: number;
  stamps: number;
  streak: number;
  lastPlay: string | null;                           // YYYY-MM-DD
  dailyDone: string | null;                          // 今日の1問を解いた日
  collected: Record<string, string>;                 // 熟語 → 初めて作った日
  hintsUsed: number;
  totalPuzzles: number;
}

export interface Report {
  word: string;
  reading: string;
  cat: Category;
  grade: number;
  at: string;
  sent: boolean;
}

export interface AppSettings {
  reportUrl: string;
  reports: Report[];
}
