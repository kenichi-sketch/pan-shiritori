import type { Category, Dict, WordInfo } from './types';

export class Dictionary {
  readonly kanji: Dict['kanji'];
  readonly words = new Map<string, WordInfo>();
  /** 先頭漢字 → 後続候補（語情報つき） */
  private readonly next = new Map<string, WordInfo[]>();
  private readonly catKanji = new Map<number, string[]>();

  constructor(d: Dict) {
    this.kanji = d.kanji;
    for (const [w, r, g, k, score, m] of d.words) {
      const info: WordInfo = { w, r, g, k, score, m };
      this.words.set(w, info);
      const list = this.next.get(w[0]);
      if (list) list.push(info);
      else this.next.set(w[0], [info]);
    }
  }

  /** 熟語として辞書にあるか（全カテゴリ・子ども向け度を問わない） */
  isWord(a: string, b: string): boolean {
    return this.words.has(a + b);
  }

  word(a: string, b: string): WordInfo | undefined {
    return this.words.get(a + b);
  }

  /** カテゴリに応じて許す子ども向け度 */
  static maxKid(cat: Category): number {
    return cat <= 3 ? 1 : cat <= 6 ? 2 : 3;
  }

  /** 出題に使える後続候補 */
  successors(a: string, cat: Category, maxScore = 99): WordInfo[] {
    const k = Dictionary.maxKid(cat);
    return (this.next.get(a) ?? []).filter((x) => x.g <= cat && x.k <= k && x.score <= maxScore);
  }

  kanjiInCategory(cat: Category): string[] {
    let list = this.catKanji.get(cat);
    if (!list) {
      list = Object.keys(this.kanji).filter((c) => this.kanji[c][0] <= cat);
      this.catKanji.set(cat, list);
    }
    return list;
  }

  /** タイルに添える読み（訓読み優先、なければ音読み） */
  reading(c: string): string {
    const e = this.kanji[c];
    if (!e) return '';
    return e[1] || e[2] || '';
  }

  grade(c: string): number {
    return this.kanji[c]?.[0] ?? 8;
  }
}

let cached: Promise<Dictionary> | null = null;
export function loadDictionary(): Promise<Dictionary> {
  if (!cached) {
    cached = fetch(`${import.meta.env.BASE_URL}data/dict.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`dict load failed: ${r.status}`);
        return r.json() as Promise<Dict>;
      })
      .then((d) => new Dictionary(d));
  }
  return cached;
}
