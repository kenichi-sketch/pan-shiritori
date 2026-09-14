# -*- coding: utf-8 -*-
"""Instagram リール用の縦動画（1080x1920, 30fps, 約16秒）を作る。
入力: data/work/reel/*.png（ヘッドレス Chrome で撮った 540x960 の画面）
出力: docs/reel/pan_shiritori_reel.mp4
"""
import os, math, subprocess, shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'data', 'work', 'reel')
OUT_DIR = os.path.join(ROOT, 'docs', 'reel'); os.makedirs(OUT_DIR, exist_ok=True)
FRAMES = os.path.join(ROOT, 'data', 'work', 'reel_frames'); shutil.rmtree(FRAMES, ignore_errors=True); os.makedirs(FRAMES)
W, H, FPS = 1080, 1920, 30
FONT = 'C:/Windows/Fonts/YuGothB.ttc'
def font(s): return ImageFont.truetype(FONT, s)
INK = (74, 59, 42); ACC = (231, 111, 81); SOFT = (138, 117, 96); GREEN = (42, 157, 143); CREAM = (255, 247, 234)

def bg():
    im = Image.new('RGB', (W, H), CREAM)
    d = ImageDraw.Draw(im)
    d.ellipse((700, -200, 1300, 400), fill=(255, 238, 214))
    d.ellipse((-250, 1500, 350, 2100), fill=(255, 233, 207))
    return im

def char(no, size):
    im = Image.open(os.path.join(ROOT, 'public', 'chars', f'{no}.webp')).convert('RGBA')
    im.thumbnail((size, size), Image.LANCZOS); return im

def text_center(d, y, s, f, fill=INK):
    w = d.textlength(s, font=f); d.text(((W - w) / 2, y), s, font=f, fill=fill)

def phone(shot_path, scale=1.0):
    """540x960 の画面を丸角の端末風に。返り値は RGBA"""
    sw, sh = int(810 * scale), int(1440 * scale)
    shot = Image.open(shot_path).convert('RGB').resize((sw, sh), Image.LANCZOS)
    r = int(48 * scale); pad = int(16 * scale)
    frame = Image.new('RGBA', (sw + pad * 2, sh + pad * 2), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle((0, 0, sw + pad * 2 - 1, sh + pad * 2 - 1), radius=r + pad, fill=(60, 48, 38, 255))
    mask = Image.new('L', (sw, sh), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), radius=r, fill=255)
    frame.paste(shot, (pad, pad), mask)
    # 影
    shadow = Image.new('RGBA', (frame.width + 80, frame.height + 80), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((40, 60, 40 + frame.width, 60 + frame.height), radius=r + pad, fill=(120, 80, 30, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    shadow.alpha_composite(frame, (40, 40))
    return shadow

def ease(t): return 0.5 - 0.5 * math.cos(math.pi * min(1, max(0, t)))

frames = []
def emit(im): frames.append(im)

# ---- シーン1: タイトル（0-2.6s）----
n1 = int(2.6 * FPS)
chars = [char('003', 420), char('005', 360), char('009', 380)]
for i in range(n1):
    t = i / n1; im = bg(); d = ImageDraw.Draw(im)
    k = ease(t * 2.2)
    # キャラが下からぽんと出る
    for j, (c, x) in enumerate(zip(chars, [330, 90, 620])):
        off = int((1 - ease(t * 2.2 - j * 0.15)) * 300)
        bob = int(math.sin((t * 4 + j) * math.pi) * 10)
        im.paste(c, (x, 720 + off + bob), c)
    a = int(255 * ease((t - 0.25) * 2))
    title = Image.new('RGBA', (W, 400), (0, 0, 0, 0)); td = ImageDraw.Draw(title)
    f = font(120); s = 'パンしりとり'; w = td.textlength(s, font=f); td.text(((W - w) / 2, 40), s, font=f, fill=INK + (a,))
    f2 = font(50); s2 = 'かんじを つなげる しりとりパズル'; w2 = td.textlength(s2, font=f2); td.text(((W - w2) / 2, 200), s2, font=f2, fill=SOFT + (a,))
    im.paste(title, (0, 260), title)
    f3 = font(44); s3 = '小学生むけ・むりょう'; w3 = td.textlength(s3, font=f3)
    lbl = Image.new('RGBA', (W, 120), (0, 0, 0, 0)); ld = ImageDraw.Draw(lbl)
    ld.rounded_rectangle(((W - w3) / 2 - 40, 10, (W + w3) / 2 + 40, 100), radius=45, fill=ACC + (a,))
    ld.text(((W - w3) / 2, 26), s3, font=f3, fill=(255, 255, 255, a))
    im.paste(lbl, (0, 1500), lbl)
    emit(im)

# ---- シーン2: あそびかた（タイルが順に置かれる）----
seq = ['play_1200', 'play_2000', 'play_2800', 'play_3600', 'play_4150']
caps = ['中学（ちゅうがく）', '学年（がくねん）', '年下（としした）', '下手（へた）', '手本（てほん）']
dur = 1.25
for idx, name in enumerate(seq):
    ph = phone(os.path.join(SRC, name + '.png'), 0.92)
    for i in range(int(dur * FPS)):
        t = i / (dur * FPS); im = bg(); d = ImageDraw.Draw(im)
        text_center(d, 120, 'となりどうしが 熟語になるように', font(54))
        text_center(d, 200, 'タイルを ならべる', font(54))
        # 端末（少しだけ寄る）
        s = 1.0 + 0.012 * ease(t)
        p = ph if s == 1.0 else ph.resize((int(ph.width * s), int(ph.height * s)), Image.LANCZOS)
        im.paste(p, ((W - p.width) // 2, 330), p)
        # 下の吹き出し（できた熟語）
        a = int(255 * ease(t * 3))
        cap = Image.new('RGBA', (W, 160), (0, 0, 0, 0)); cd = ImageDraw.Draw(cap)
        f = font(60); s_ = caps[idx]; w = cd.textlength(s_, font=f)
        cd.rounded_rectangle(((W - w) / 2 - 50, 10, (W + w) / 2 + 50, 140), radius=40, fill=(255, 255, 255, a))
        cd.text(((W - w) / 2, 38), s_, font=f, fill=GREEN + (a,))
        im.paste(cap, (0, 1720), cap)
        emit(im)

# ---- シーン3: クリア ----
ph = phone(os.path.join(SRC, 'clear.png'), 0.92)
n3 = int(3.0 * FPS)
for i in range(n3):
    t = i / n3; im = bg(); d = ImageDraw.Draw(im)
    text_center(d, 110, 'できた！', font(110), ACC)
    text_center(d, 250, 'よみあげ・いみ つき', font(50), SOFT)
    im.paste(ph, ((W - ph.width) // 2, 330), ph)
    emit(im)

# ---- シーン4: エンド（URL・QR）----
qr = Image.open(os.path.join(ROOT, 'public', 'qr.png')).convert('RGB').resize((520, 520), Image.NEAREST)
c3 = char('003', 380); c5 = char('005', 300); c9 = char('009', 320)
n4 = int(3.6 * FPS)
for i in range(n4):
    t = i / n4; im = bg(); d = ImageDraw.Draw(im)
    text_center(d, 150, 'パンしりとり', font(110))
    text_center(d, 300, 'インストール ふよう・むりょう', font(48), SOFT)
    card = Image.new('RGB', (600, 600), (255, 255, 255)); card.paste(qr, (40, 40))
    im.paste(card, ((W - 600) // 2, 470))
    text_center(d, 1120, 'shiritori.ak-base.com', font(58), GREEN)
    text_center(d, 1210, 'プロフィールの リンクから あそべます', font(40), SOFT)
    bob = int(math.sin(t * 2 * math.pi * 1.5) * 8)
    im.paste(c9, (80, 1400 + bob), c9); im.paste(c3, (360, 1360 - bob), c3); im.paste(c5, (720, 1420 + bob), c5)
    emit(im)

print('frames:', len(frames), f'({len(frames) / FPS:.1f}s)')
for i, im in enumerate(frames):
    im.save(os.path.join(FRAMES, f'f{i:04d}.png'), compress_level=1)

ff = imageio_ffmpeg.get_ffmpeg_exe()
out = os.path.join(OUT_DIR, 'pan_shiritori_reel.mp4')
subprocess.run([ff, '-y', '-framerate', str(FPS), '-i', os.path.join(FRAMES, 'f%04d.png'),
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', out], check=True,
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print('saved', out, os.path.getsize(out) // 1024, 'KB')
