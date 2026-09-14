# -*- coding: utf-8 -*-
"""note 用ヘッダー画像（1280x670）を作る"""
from PIL import Image, ImageDraw, ImageFont
import os
ROOT = os.path.join(os.path.dirname(__file__), '..')
W, H = 1280, 670
img = Image.new('RGBA', (W, H), (255, 247, 234, 255))
d = ImageDraw.Draw(img)

# やわらかい背景の丸
for cx, cy, r, col in [(1100, 80, 260, (255, 238, 214, 255)), (180, 620, 220, (255, 233, 207, 255))]:
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=col)

FONT_B = '/c/Windows/Fonts/YuGothB.ttc'.replace('/c/', 'C:/')
def font(size): return ImageFont.truetype(FONT_B, size)

# 左: タイトル
INK = (74, 59, 42, 255); ACC = (231, 111, 81, 255); SOFT = (138, 117, 96, 255); GREEN = (42, 157, 143, 255)
d.text((80, 96), '小1の娘のために', font=font(56), fill=INK)
d.text((80, 176), '漢字しりとりアプリを', font=font(56), fill=INK)
d.text((80, 256), '1日で作って公開した話', font=font(56), fill=INK)
d.text((84, 352), 'パンしりとり  shiritori.ak-base.com', font=font(28), fill=SOFT)

# 漢字タイルの連鎖（学→校→長→男）
tiles = [('学', 'がく'), ('校', 'こう'), ('長', 'ちょう'), ('男', 'なん')]
x0, y0, size, gap = 84, 440, 120, 34
for i, (k, r) in enumerate(tiles):
    x = x0 + i * (size + gap)
    d.rounded_rectangle((x + 4, y0 + 6, x + size + 4, y0 + size + 6), radius=22, fill=(232, 201, 163, 255))
    d.rounded_rectangle((x, y0, x + size, y0 + size), radius=22, fill=(255, 253, 248, 255), outline=(232, 201, 163, 255), width=4)
    f = font(64); bw = d.textlength(k, font=f)
    d.text((x + (size - bw) / 2, y0 + 14), k, font=f, fill=INK)
    fr = font(18); rw = d.textlength(r, font=fr)
    d.text((x + (size - rw) / 2, y0 + 88), r, font=fr, fill=SOFT)
    if i < len(tiles) - 1:
        ax = x + size + 6
        d.text((ax, y0 + 42), '▶', font=font(26), fill=GREEN)
d.text((x0, y0 + size + 18), '学校 ・ 校長 ・ 長男　となりどうしが熟語になるように並べる', font=font(22), fill=SOFT)

# 右: パンの申し子たち
def paste(no, x, y, s):
    im = Image.open(os.path.join(ROOT, 'public', 'chars', f'{no}.webp')).convert('RGBA')
    im.thumbnail((s, s), Image.LANCZOS)
    img.alpha_composite(im, (x, y))
paste('009', 760, 60, 300)
paste('005', 1000, 40, 250)
paste('003', 900, 300, 320)

out = os.path.join(ROOT, 'docs', 'screenshots', 'note_eyecatch.png')
img.convert('RGB').save(out, quality=95)
print('saved', out)
