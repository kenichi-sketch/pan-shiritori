/** 連続出題で同じ熟語がどれだけ繰り返されるかを測る（スコアアタック相当: L1〜L5 を1問ずつ） */
import { readFileSync } from 'node:fs';
import { Dictionary } from '../src/data';
import { availableWordCount, generatePuzzle, levelConfig } from '../src/game';
import type { Category, Dict } from '../src/types';

const dict = new Dictionary(JSON.parse(readFileSync('public/data/dict.json', 'utf-8')) as Dict);
for (const cat of [1, 2, 3] as Category[]) {
  let totalWords = 0, repeatsInRun = 0, repeatsRecent = 0;
  const RUNS = 40;
  const recentKeys = new Set<string>();
  const recentWords = new Set<string>();
  const remember = (answer: string[]) => {
    for (let i = 0; i + 1 < answer.length; i++) { const w = answer[i] + answer[i + 1]; recentWords.delete(w); recentWords.add(w); }
    const cap = Math.max(15, Math.min(60, Math.floor(availableWordCount(dict, cat) / 3)));
    while (recentWords.size > cap) recentWords.delete(recentWords.values().next().value as string);
  };
  let seed = 1000 + cat;
  for (let r = 0; r < RUNS; r++) {
    const seenInRun = new Set<string>();
    for (let lv = 1; lv <= 5; lv++) {
      const p = generatePuzzle(dict, cat, levelConfig(lv, 1), seed++, recentKeys, recentWords, seenInRun);
      const words: string[] = [];
      for (let i = 0; i + 1 < p.answer.length; i++) words.push(p.answer[i] + p.answer[i + 1]);
      for (const w of words) {
        totalWords++;
        if (seenInRun.has(w)) repeatsInRun++;
        if (recentWords.has(w)) repeatsRecent++;
        seenInRun.add(w);
      }
      recentKeys.add(p.answer.join(''));
      remember(p.answer);
    }
  }
  console.log(`cat=${cat}: 熟語${totalWords}個中、同じ5問セット内の重複=${repeatsInRun} (${(100 * repeatsInRun / totalWords).toFixed(1)}%)、直近60語との重複=${repeatsRecent} (${(100 * repeatsRecent / totalWords).toFixed(1)}%)`);
}
