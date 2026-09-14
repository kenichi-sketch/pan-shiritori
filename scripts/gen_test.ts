/** 出題生成の健全性テスト: 全カテゴリ×全レベルで生成し、失敗・所要時間・ヒント到達性を確認する */
import { readFileSync } from 'node:fs';
import { Dictionary } from '../src/data';
import { generatePuzzle, levelConfig, hint, checkChain } from '../src/game';
import type { Category, Dict } from '../src/types';

const dict = new Dictionary(JSON.parse(readFileSync('public/data/dict.json', 'utf-8')) as Dict);
const cats: Category[] = [1, 2, 3, 4, 5, 6, 8];
const configs = [levelConfig(1), levelConfig(2), levelConfig(3), levelConfig(4), levelConfig(5, 1), levelConfig(5, 2), levelConfig(5, 3)];
let fails = 0, shortened = 0;
for (const cat of cats) {
  for (const cfg of configs) {
    const t0 = performance.now();
    const N = 60;
    const uniq = new Set<string>();
    let hintOk = 0;
    for (let i = 0; i < N; i++) {
      try {
        const p = generatePuzzle(dict, cat, cfg, (cat * 1000 + cfg.level * 10 + cfg.star) * 7919 + i);
        if (!checkChain(dict, p.answer).ok) throw new Error('answer invalid');
        if (p.answer.length < cfg.n) shortened++;
        uniq.add(p.answer.join(''));
        // ヒントが先頭から最後まで導けるか
        const placed = p.first ? [p.first] : [];
        let remaining = p.tiles.slice();
        let ok = true;
        while (placed.length < p.cfg.n) {
          const r = hint(dict, placed, remaining, p.cfg.n);
          if (!r.tile) { ok = false; break; }
          placed.push(r.tile); remaining = remaining.filter((x) => x !== r.tile);
        }
        if (ok) hintOk++;
      } catch (e) { fails++; console.log('FAIL', cat, cfg.level, cfg.star, (e as Error).message); }
    }
    const ms = ((performance.now() - t0) / N).toFixed(1);
    console.log(`cat=${cat} L${cfg.level}★${cfg.star} n=${cfg.n}: ${ms}ms/問 unique=${uniq.size}/${N} hintOk=${hintOk}/${N}`);
  }
}
// 例を表示
for (const cat of [1, 3, 8] as Category[]) {
  const p = generatePuzzle(dict, cat, levelConfig(5, 1), 42);
  console.log(`例 cat=${cat}: ${p.answer.join('→')}  tiles=[${p.tiles.join(' ')}]`);
}
console.log('fails', fails, 'shortened', shortened);
