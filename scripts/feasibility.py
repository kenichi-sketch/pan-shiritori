# -*- coding: utf-8 -*-
"""学年カテゴリごとの二字熟語数と連鎖可能数を数える（要件定義用の実現性調査）"""
import xml.etree.ElementTree as ET, sys, json, collections, os
sys.stdout.reconfigure(encoding='utf-8')
RAW = os.path.join(os.path.dirname(__file__), '..', 'data', 'raw')

# ---- KANJIDIC2: 漢字→学年 (1-6 小学, 8 中学常用) ----
grade = {}
for ev, el in ET.iterparse(os.path.join(RAW, 'kanjidic2.xml'), events=('end',)):
    if el.tag == 'character':
        lit = el.findtext('literal'); g = el.findtext('misc/grade')
        if g is not None and int(g) in (1,2,3,4,5,6,8):
            grade[lit] = int(g)
        el.clear()
cnt = collections.Counter(grade.values())
print('常用漢字 学年別字数:', dict(sorted(cnt.items())), '合計', sum(cnt.values()))

# ---- JMdict: 二字熟語（両方常用漢字）で優先タグ付きの語 ----
BAD_MISC = {'vulgar','derogatory','archaic','obsolete','sensitive','rare','obscure','slang','X','vulg','derog','arch','obs','sens','sl','col'}
words = {}  # keb -> dict(reading, pri, grade)
n_all2 = 0
for ev, el in ET.iterparse(os.path.join(RAW, 'JMdict_e.xml'), events=('end',)):
    if el.tag != 'entry': continue
    kebs = el.findall('k_ele')
    if kebs:
        first_keb = kebs[0].findtext('keb')
        misc = {m.text for m in el.iter('misc')}
        for k in kebs:
            keb = k.findtext('keb')
            if len(keb) == 2 and keb[0] in grade and keb[1] in grade and keb[0] != keb[1]:
                n_all2 += 1
                pris = [p.text for p in k.findall('ke_pri')]
                if not pris: continue
                if misc & BAD_MISC: continue
                # 読み: この表記に対応する最初の reb
                reb = None
                for r in el.findall('r_ele'):
                    restr = [x.text for x in r.findall('re_restr')]
                    if not restr or keb in restr:
                        reb = r.findtext('reb'); break
                if reb is None: continue
                g = max(grade[keb[0]], grade[keb[1]])
                # 優先度スコア: nfXX が小さいほど高頻度
                nf = min([int(p[2:]) for p in pris if p.startswith('nf')] or [99])
                score = nf if nf < 99 else (60 if any(p in ('ichi1','news1','spec1') for p in pris) else 80)
                if keb not in words or words[keb]['score'] > score:
                    words[keb] = {'r': reb, 'g': g, 'score': score, 'pri': pris}
    el.clear()
print('二字熟語(両方常用) 全候補:', n_all2, ' 優先タグ付き採用:', len(words))

os.makedirs(os.path.join(RAW, '..', 'work'), exist_ok=True)
with open(os.path.join(RAW, '..', 'work', 'jukugo_candidates.json'), 'w', encoding='utf-8') as f:
    json.dump(words, f, ensure_ascii=False, indent=0)

# ---- カテゴリごとの連鎖数 ----
CATS = [(1,'小1まで'),(2,'小2まで'),(3,'小3まで'),(4,'小4まで'),(5,'小5まで'),(6,'小6まで'),(8,'中3まで')]
CAP = 200000
def count_paths(adj, L):
    """L枚のタイルを使う単純パス（漢字重複なし）の本数（上限CAP）"""
    total = 0
    def dfs(node, depth, used):
        nonlocal total
        if total >= CAP: return
        if depth == L:
            total += 1; return
        for nxt in adj.get(node, ()):
            if nxt not in used:
                used.add(nxt); dfs(nxt, depth+1, used); used.discard(nxt)
    for s in adj:
        dfs(s, 1, {s})
        if total >= CAP: break
    return total

print()
print(f"{'カテゴリ':8} {'漢字数':>6} {'熟語数':>6} {'3枚':>8} {'4枚':>8} {'5枚':>8} {'6枚':>8} {'7枚':>8} {'8枚':>8}")
for g, name in CATS:
    ks = {k for k,v in grade.items() if v <= g}
    ws = {w:v for w,v in words.items() if v['g'] <= g}
    adj = collections.defaultdict(list)
    for w in ws: adj[w[0]].append(w[1])
    row = [count_paths(adj, L) for L in (3,4,5,6,7,8)]
    fmt = lambda n: f"{n:>8}" if n < CAP else f"{'>'+str(CAP):>8}"
    print(f"{name:8} {len(ks):>6} {len(ws):>6} " + ''.join(fmt(n) for n in row))

# サンプル表示
print()
for g, name in CATS[:2]:
    ws = sorted([w for w,v in words.items() if v['g'] <= g], key=lambda w: words[w]['score'])
    print(name, len(ws), '語 例:', ' '.join(f"{w}({words[w]['r']})" for w in ws[:40]))
