// scripts/repeat_test.ts
import { readFileSync } from "node:fs";

// src/data.ts
var Dictionary = class _Dictionary {
  constructor(d) {
    this.words = /* @__PURE__ */ new Map();
    /** 先頭漢字 → 後続候補（語情報つき） */
    this.next = /* @__PURE__ */ new Map();
    this.catKanji = /* @__PURE__ */ new Map();
    this.kanji = d.kanji;
    for (const [w, r, g, k, score, m, split] of d.words) {
      const info = { w, r, g, k, score, m, split: split ?? null };
      this.words.set(w, info);
      const list = this.next.get(w[0]);
      if (list) list.push(info);
      else this.next.set(w[0], [info]);
    }
  }
  /** 熟語として辞書にあるか（全カテゴリ・子ども向け度を問わない） */
  isWord(a, b) {
    return this.words.has(a + b);
  }
  word(a, b) {
    return this.words.get(a + b);
  }
  /** カテゴリに応じて許す子ども向け度 */
  static maxKid(cat) {
    return cat <= 3 ? 1 : cat <= 6 ? 2 : 3;
  }
  /** 出題に使える後続候補 */
  successors(a, cat, maxScore = 99) {
    const k = _Dictionary.maxKid(cat);
    return (this.next.get(a) ?? []).filter((x) => x.g <= cat && x.k <= k && x.score <= maxScore);
  }
  kanjiInCategory(cat) {
    let list = this.catKanji.get(cat);
    if (!list) {
      list = Object.keys(this.kanji).filter((c) => this.kanji[c][0] <= cat);
      this.catKanji.set(cat, list);
    }
    return list;
  }
  /** タイルに添える既定の読み。熟語では音読みが多いので音読み優先、なければ訓読み */
  reading(c) {
    const e = this.kanji[c];
    if (!e) return "";
    return e[2] || e[1] || "";
  }
  /** 熟語 prev+c における c の読み（分割できない語は null） */
  readingIn(prev, c) {
    return this.word(prev, c)?.split?.[1] ?? null;
  }
  /** 熟語 c+next における c の読み */
  readingBefore(c, next) {
    return this.word(c, next)?.split?.[0] ?? null;
  }
  grade(c) {
    return this.kanji[c]?.[0] ?? 8;
  }
};

// src/rng.ts
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// src/game.ts
function levelConfig(level, star = 1) {
  switch (level) {
    case 1:
      return { level, star: 1, n: 3, dummies: 0, fixedFirst: true, furigana: true };
    case 2:
      return { level, star: 1, n: 4, dummies: 0, fixedFirst: true, furigana: true };
    case 3:
      return { level, star: 1, n: 5, dummies: 0, fixedFirst: true, furigana: true };
    case 4:
      return { level, star: 1, n: 6, dummies: 1, fixedFirst: true, furigana: true };
    default:
      if (star >= 3) return { level: 5, star: 3, n: 8, dummies: 4, fixedFirst: false, furigana: false };
      if (star === 2) return { level: 5, star: 2, n: 7, dummies: 3, fixedFirst: false, furigana: true };
      return { level: 5, star: 1, n: 7, dummies: 3, fixedFirst: true, furigana: true };
  }
}
function scoreLimit(cat) {
  return cat <= 2 ? 99 : cat <= 4 ? 48 : 40;
}
function findChain(dict2, cat, n, rng, avoid, avoidWords, hardAvoid, strict) {
  const limit = scoreLimit(cat);
  const banned = (w) => hardAvoid.has(w) || strict && avoidWords.has(w);
  const starts = shuffle(
    dict2.kanjiInCategory(cat).filter((k) => dict2.successors(k, cat, limit).some((x) => !banned(x.w))),
    rng
  );
  for (let attempt = 0; attempt < Math.min(300, starts.length); attempt++) {
    const start = starts[attempt];
    const path = [start];
    const used = new Set(path);
    let steps = 0;
    const dfs = () => {
      if (path.length === n) return true;
      if (++steps > 4e3) return false;
      const cur = path[path.length - 1];
      const cands = dict2.successors(cur, cat, limit).filter((x) => !used.has(x.w[1]) && !banned(x.w));
      const ordered = shuffle(cands, rng).map((c) => ({ c, key: c.score * 0.3 + rng() * 40 + (avoidWords.has(c.w) ? 200 : 0) })).sort((a, b) => a.key - b.key).map((x) => x.c);
      for (const c of ordered) {
        const nx = c.w[1];
        path.push(nx);
        used.add(nx);
        if (dfs()) return true;
        path.pop();
        used.delete(nx);
      }
      return false;
    };
    if (dfs() && !avoid.has(path.join(""))) return path;
  }
  return null;
}
function availableWordCount(dict2, cat) {
  const limit = scoreLimit(cat);
  let n = 0;
  for (const k of dict2.kanjiInCategory(cat)) n += dict2.successors(k, cat, limit).length;
  return n;
}
function generatePuzzle(dict2, cat, cfg, seed, avoid = /* @__PURE__ */ new Set(), avoidWords = /* @__PURE__ */ new Set(), hardAvoid = /* @__PURE__ */ new Set()) {
  const rng = mulberry32(seed);
  let n = cfg.n;
  let answer = findChain(dict2, cat, n, rng, avoid, avoidWords, hardAvoid, true);
  if (!answer) answer = findChain(dict2, cat, n, rng, avoid, avoidWords, hardAvoid, false);
  if (!answer && avoid.size) answer = findChain(dict2, cat, n, rng, /* @__PURE__ */ new Set(), avoidWords, hardAvoid, false);
  if (!answer && hardAvoid.size) answer = findChain(dict2, cat, n, rng, /* @__PURE__ */ new Set(), avoidWords, /* @__PURE__ */ new Set(), false);
  while (!answer && n > 3) {
    n--;
    answer = findChain(dict2, cat, n, rng, /* @__PURE__ */ new Set(), avoidWords, /* @__PURE__ */ new Set(), false);
  }
  if (!answer) throw new Error("puzzle generation failed");
  const used = new Set(answer);
  const pool = shuffle(dict2.kanjiInCategory(cat).filter((c) => !used.has(c)), rng);
  const dummies = pool.slice(0, cfg.dummies);
  const first = cfg.fixedFirst ? answer[0] : null;
  const rest = cfg.fixedFirst ? answer.slice(1) : answer.slice();
  const tiles = shuffle([...rest, ...dummies], rng);
  return { cat, cfg: { ...cfg, n: answer.length }, answer, tiles, first, seed };
}

// scripts/repeat_test.ts
var dict = new Dictionary(JSON.parse(readFileSync("public/data/dict.json", "utf-8")));
for (const cat of [1, 2, 3]) {
  let totalWords = 0, repeatsInRun = 0, repeatsRecent = 0;
  const RUNS = 40;
  const recentKeys = /* @__PURE__ */ new Set();
  const recentWords = /* @__PURE__ */ new Set();
  const remember = (answer) => {
    for (let i = 0; i + 1 < answer.length; i++) {
      const w = answer[i] + answer[i + 1];
      recentWords.delete(w);
      recentWords.add(w);
    }
    const cap = Math.max(15, Math.min(60, Math.floor(availableWordCount(dict, cat) / 3)));
    while (recentWords.size > cap) recentWords.delete(recentWords.values().next().value);
  };
  let seed = 1e3 + cat;
  for (let r = 0; r < RUNS; r++) {
    const seenInRun = /* @__PURE__ */ new Set();
    for (let lv = 1; lv <= 5; lv++) {
      const p = generatePuzzle(dict, cat, levelConfig(lv, 1), seed++, recentKeys, recentWords, seenInRun);
      const words = [];
      for (let i = 0; i + 1 < p.answer.length; i++) words.push(p.answer[i] + p.answer[i + 1]);
      for (const w of words) {
        totalWords++;
        if (seenInRun.has(w)) repeatsInRun++;
        if (recentWords.has(w)) repeatsRecent++;
        seenInRun.add(w);
      }
      recentKeys.add(p.answer.join(""));
      remember(p.answer);
    }
  }
  console.log(`cat=${cat}: \u719F\u8A9E${totalWords}\u500B\u4E2D\u3001\u540C\u30585\u554F\u30BB\u30C3\u30C8\u5185\u306E\u91CD\u8907=${repeatsInRun} (${(100 * repeatsInRun / totalWords).toFixed(1)}%)\u3001\u76F4\u8FD160\u8A9E\u3068\u306E\u91CD\u8907=${repeatsRecent} (${(100 * repeatsRecent / totalWords).toFixed(1)}%)`);
}
