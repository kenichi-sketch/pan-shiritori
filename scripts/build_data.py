# -*- coding: utf-8 -*-
"""候補語 + 子ども向け判定 → public/data/dict.json を生成

入力:
  data/raw/kanjidic2.xml            漢字の学年・読み
  data/work/jukugo_candidates.json  JMdict から抽出した二字熟語候補（feasibility.py が生成）
  data/work/tags/*.jsonl            Claude による子ども向け度 k と意味 m
  data/work/fix/*.jsonl             意味の書き直し（あれば上書き）
  data/work/overrides.json          手動の上書き {"熟語": {"k": 0}} など（あれば）
"""
import json, os, sys, glob, re, collections
import xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.join(os.path.dirname(__file__), '..')
RAW = os.path.join(ROOT, 'data', 'raw'); WORK = os.path.join(ROOT, 'data', 'work')

def kata2hira(s):
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)

# ---- 意味の漢字をひらがなに（判定エージェントが漢字を混ぜた場合の保険） ----
try:
    import pykakasi
    _kks = pykakasi.kakasi()
except ImportError:
    _kks = None
KANJI_RE = re.compile(r'[一-鿿]')
PRE = [(re.compile(r'(?<![一-鿿])人(?![一-鿿])'), 'ひと'),
       (re.compile(r'(?<![一-鿿])物(?![一-鿿])'), 'もの'),
       (re.compile(r'(?<![一-鿿])事(?![一-鿿])'), 'こと'),
       (re.compile(r'(?<![一-鿿])所(?![一-鿿])'), 'ところ'),
       (re.compile(r'(?<![一-鿿])時(?![一-鿿])'), 'とき'),
       (re.compile(r'(?<![一-鿿])月(?![一-鿿])'), 'つき'),
       (re.compile(r'(?<![一-鿿])日(?![一-鿿])'), 'ひ')]
def hiraganize(m):
    if not m or not KANJI_RE.search(m): return m
    for rx, rep in PRE: m = rx.sub(rep, m)
    if _kks is None: return ''
    return ''.join(x['hira'] for x in _kks.convert(m))

# ---- 子どもアプリとしての追加ルール（判定の取りこぼし対策） ----
BAN_KANJI = set('殺姦淫娼妾銃刃葬喪墓賭酒')          # 含む語は出さない
MIN_K3 = set('死毒爆煙兵軍戦敵闘撃襲牲奴虜姫妃娠嫡')  # 含む語は中学カテゴリのみ
MIN_K2_EXCEPT = {'挑戦', '作戦', '対戦', '観戦', '爆笑', '消毒', '禁煙', '兵士', '軍手', '素敵', '無敵', '敵', '闘志', '格闘'}  # 高学年なら可
NUM = set('一二三四五六七八九十百千万')

# 漢字: 学年 + 読み(訓, 音)
kanji = {}
for ev, el in ET.iterparse(os.path.join(RAW, 'kanjidic2.xml'), events=('end',)):
    if el.tag == 'character':
        g = el.findtext('misc/grade')
        if g is not None and int(g) in (1,2,3,4,5,6,8):
            kun = on = ''
            for r in el.iter('reading'):
                t = r.get('r_type')
                if t == 'ja_kun' and not kun: kun = r.text.split('.')[0].lstrip('-')
                if t == 'ja_on' and not on: on = kata2hira(r.text)
            kanji[el.findtext('literal')] = [int(g), kun, on]
        el.clear()

cand = json.load(open(os.path.join(WORK, 'jukugo_candidates.json'), encoding='utf-8'))

def read_jsonl(pattern):
    out = {}
    for p in sorted(glob.glob(pattern)):
        for line in open(p, encoding='utf-8'):
            line = line.strip()
            if not line: continue
            try:
                o = json.loads(line)
                if 'w' in o: out[o['w']] = o
            except json.JSONDecodeError:
                pass
    return out

tags = read_jsonl(os.path.join(WORK, 'tags', '*.jsonl'))
fixes = read_jsonl(os.path.join(WORK, 'fix', '*.jsonl'))
override_path = os.path.join(WORK, 'overrides.json')
overrides = json.load(open(override_path, encoding='utf-8')) if os.path.exists(override_path) else {}

words = []
stats = collections.Counter(); untagged = 0; rule_hits = collections.Counter(); hira_fixed = 0
for w, v in cand.items():
    if w[0] in NUM and w[1] in NUM: continue
    t = tags.get(w)
    if t is None:
        untagged += 1; continue
    k = t.get('k', 0) if isinstance(t.get('k'), int) else 0
    m = t.get('m', '') or ''
    if w in fixes and fixes[w].get('m'): m = fixes[w]['m']
    # ルール
    if set(w) & BAN_KANJI: k = 0; rule_hits['ban'] += 1
    elif set(w) & MIN_K3 and w not in MIN_K2_EXCEPT and k > 0:
        if k < 3: rule_hits['min3'] += 1
        k = 3
    elif w in MIN_K2_EXCEPT and 0 < k < 2:
        k = 2; rule_hits['min2'] += 1
    if w in overrides:
        k = overrides[w].get('k', k); m = overrides[w].get('m', m)
    if k == 0: stats['excluded'] += 1; continue
    m2 = hiraganize(m)
    if m2 != m: hira_fixed += 1
    m = re.sub(r'\s+', ' ', m2).strip()
    if len(m) > 28: m = m[:28]
    words.append([w, v['r'], v['g'], k, v['score'], m])
    stats[(v['g'], k)] += 1

words.sort(key=lambda x: (x[2], x[4], x[0]))
os.makedirs(os.path.join(ROOT, 'public', 'data'), exist_ok=True)
with open(os.path.join(ROOT, 'public', 'data', 'dict.json'), 'w', encoding='utf-8') as f:
    json.dump({'kanji': kanji, 'words': words}, f, ensure_ascii=False, separators=(',', ':'))

print('words:', len(words), 'excluded:', stats['excluded'], 'untagged:', untagged, 'rule:', dict(rule_hits), '意味ひらがな化:', hira_fixed)
pairs = [(key, c) for key, c in stats.items() if isinstance(key, tuple)]
for g in (1,2,3,4,5,6,8):
    print(f"  grade<={g}: k1={sum(c for (gg,k),c in pairs if gg<=g and k==1)} k<=2={sum(c for (gg,k),c in pairs if gg<=g and k<=2)} all={sum(c for (gg,k),c in pairs if gg<=g)}")
