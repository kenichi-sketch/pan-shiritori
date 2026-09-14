// scripts/gen_test.ts
import { readFileSync } from "node:fs";

// src/data.ts
var Dictionary = class _Dictionary {
  constructor(d) {
    this.words = /* @__PURE__ */ new Map();
    /** 先頭漢字 → 後続候補（語情報つき） */
    this.next = /* @__PURE__ */ new Map();
    this.catKanji = /* @__PURE__ */ new Map();
    this.kanji = d.kanji;
    for (const [w, r, g, k, score, m] of d.words) {
      const info = { w, r, g, k, score, m };
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
  /** タイルに添える読み（訓読み優先、なければ音読み） */
  reading(c) {
    const e = this.kanji[c];
    if (!e) return "";
    return e[1] || e[2] || "";
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
function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
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
function findChain(dict2, cat, n, rng, avoid) {
  const kanji = dict2.kanjiInCategory(cat);
  const limit = scoreLimit(cat);
  for (let attempt = 0; attempt < 300; attempt++) {
    const start = pick(kanji, rng);
    if (dict2.successors(start, cat, limit).length === 0) continue;
    const path = [start];
    const used = new Set(path);
    let steps = 0;
    const dfs = () => {
      if (path.length === n) return true;
      if (++steps > 4e3) return false;
      const cur = path[path.length - 1];
      const cands = dict2.successors(cur, cat, limit).filter((x) => !used.has(x.w[1]));
      const ordered = shuffle(cands, rng).map((c) => ({ c, key: c.score + rng() * 40 })).sort((a, b) => a.key - b.key).map((x) => x.c);
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
function generatePuzzle(dict2, cat, cfg, seed, avoid = /* @__PURE__ */ new Set()) {
  const rng = mulberry32(seed);
  let n = cfg.n;
  let answer = findChain(dict2, cat, n, rng, avoid);
  while (!answer && n > 3) {
    n--;
    answer = findChain(dict2, cat, n, rng, avoid);
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
function checkChain(dict2, chain) {
  const joints = [];
  for (let i = 0; i + 1 < chain.length; i++) joints.push(dict2.isWord(chain[i], chain[i + 1]));
  return { ok: joints.every(Boolean), joints };
}
function hint(dict2, placed, remaining, n) {
  for (let i = 0; i + 1 < placed.length; i++) {
    if (!dict2.isWord(placed[i], placed[i + 1])) return { removeFrom: i + 1 };
  }
  const need = n - placed.length;
  if (need <= 0) return {};
  const canFinish = (last2, left, depth) => {
    if (depth === 0) return true;
    for (let i = 0; i < left.length; i++) {
      if (dict2.isWord(last2, left[i])) {
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
    if (dict2.isWord(last, t) && canFinish(t, remaining.filter((x) => x !== t), need - 1)) return { tile: t };
  }
  return { removeFrom: Math.max(0, placed.length - 1) };
}

// scripts/gen_test.ts
var dict = new Dictionary(JSON.parse(readFileSync("public/data/dict.json", "utf-8")));
var cats = [1, 2, 3, 4, 5, 6, 8];
var configs = [levelConfig(1), levelConfig(2), levelConfig(3), levelConfig(4), levelConfig(5, 1), levelConfig(5, 2), levelConfig(5, 3)];
var fails = 0;
var shortened = 0;
for (const cat of cats) {
  for (const cfg of configs) {
    const t0 = performance.now();
    const N = 60;
    const uniq = /* @__PURE__ */ new Set();
    let hintOk = 0;
    for (let i = 0; i < N; i++) {
      try {
        const p = generatePuzzle(dict, cat, cfg, (cat * 1e3 + cfg.level * 10 + cfg.star) * 7919 + i);
        if (!checkChain(dict, p.answer).ok) throw new Error("answer invalid");
        if (p.answer.length < cfg.n) shortened++;
        uniq.add(p.answer.join(""));
        const placed = p.first ? [p.first] : [];
        let remaining = p.tiles.slice();
        let ok = true;
        while (placed.length < p.cfg.n) {
          const r = hint(dict, placed, remaining, p.cfg.n);
          if (!r.tile) {
            ok = false;
            break;
          }
          placed.push(r.tile);
          remaining = remaining.filter((x) => x !== r.tile);
        }
        if (ok) hintOk++;
      } catch (e) {
        fails++;
        console.log("FAIL", cat, cfg.level, cfg.star, e.message);
      }
    }
    const ms = ((performance.now() - t0) / N).toFixed(1);
    console.log(`cat=${cat} L${cfg.level}\u2605${cfg.star} n=${cfg.n}: ${ms}ms/\u554F unique=${uniq.size}/${N} hintOk=${hintOk}/${N}`);
  }
}
for (const cat of [1, 3, 8]) {
  const p = generatePuzzle(dict, cat, levelConfig(5, 1), 42);
  console.log(`\u4F8B cat=${cat}: ${p.answer.join("\u2192")}  tiles=[${p.tiles.join(" ")}]`);
}
console.log("fails", fails, "shortened", shortened);
