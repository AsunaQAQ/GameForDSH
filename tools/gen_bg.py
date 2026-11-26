# -*- coding: utf-8 -*-
"""Generate pixel-art background plates for NIGHTFALL (all source art is read-only)."""
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "方舟冒险"
OUT = Path(__file__).resolve().parents[1] / "assets"
PREVIEW = Path(__file__).resolve().parent / "preview_bg.png"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 480, 360  # one loop half; 90px vertical overscan


def load(name, group="环境参考"):
    return Image.open(SRC / group / name).convert("RGB")


def fit(im, w=W, h=H):
    return ImageOps.fit(im, (w, h), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def grade(im, mul=(1, 1, 1), add=(0, 0, 0), contrast=1.0, sat=1.0, gamma=1.0):
    a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0
    lum = a @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    a = lum[..., None] + (a - lum[..., None]) * sat
    a = (a - 0.5) * contrast + 0.5
    a = a * np.array(mul, dtype=np.float32) + np.array(add, dtype=np.float32)
    a = np.clip(a, 0.0, 1.0) ** gamma
    return Image.fromarray((a * 255).astype(np.uint8))


def quantize(im, colors=30, dither=Image.Dither.NONE):
    return im.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=dither).convert("RGB")


def make_loop(im):
    canvas = Image.new(im.mode, (im.width * 2, im.height))
    canvas.paste(im, (0, 0))
    canvas.paste(ImageOps.mirror(im), (im.width, 0))
    return canvas


# ---------------------------------------------------------------- far: storm sky
far = fit(grade(load("avg_9_2.png"), mul=(0.95, 1.02, 1.3), add=(0.02, 0.03, 0.07),
                contrast=1.14, sat=0.72, gamma=0.92))
far = far.filter(ImageFilter.GaussianBlur(0.4))
far = quantize(far, 30, Image.Dither.FLOYDSTEINBERG)
make_loop(far).save(OUT / "bg_far.png")

# ---------------------------------------------------------------- mid: neon street
mid = fit(grade(load("bg_ssLine_5.png"), mul=(1.0, 1.08, 1.34), add=(0.015, 0.02, 0.06),
                contrast=1.1, sat=0.9, gamma=1.0))
mid = quantize(mid, 34, Image.Dither.FLOYDSTEINBERG).convert("RGBA")
# fade the sky area out so the far storm plate reads through
arr = np.asarray(mid).copy()
ys = np.arange(mid.height, dtype=np.float32)
a = np.clip((ys - 42.0) / 92.0, 0.0, 1.0)
arr[:, :, 3] = (a[:, None] * 255).astype(np.uint8)
mid = Image.fromarray(arr, "RGBA")
make_loop(mid).save(OUT / "bg_mid.png")

# ---------------------------------------------------------------- near: silhouettes
random.seed(7)
near = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(near)
BASE = H + 6
colors = [(8, 12, 24), (10, 15, 30), (13, 19, 36), (7, 10, 20)]
x = -30
while x < W + 30:
    bw = random.randint(36, 110)
    bh = random.randint(42, 122)
    top = BASE - bh
    c = random.choice(colors)
    d.rectangle([x, top, x + bw, BASE], fill=c + (255,))
    rim = (26, 42, 74, 255) if bh > 140 else (20, 32, 58, 255)
    d.line([x, top, x + bw, top], fill=rim)
    # roof furniture
    if random.random() < 0.65:
        ax = x + random.randint(6, max(8, bw - 10))
        ah = random.randint(8, 30)
        d.rectangle([ax, top - ah, ax + 2, top], fill=(9, 13, 26, 255))
        if random.random() < 0.5:
            d.rectangle([ax - 4, top - ah - 3, ax + 6, top - ah], fill=(9, 13, 26, 255))
    # windows
    for wy in range(top + 10, BASE - 12, 9):
        for wx in range(x + 6, x + bw - 6, 8):
            if random.random() < 0.16:
                wc = random.choice([(90, 200, 220), (232, 170, 92), (120, 170, 255), (235, 108, 150)])
                a = random.randint(60, 150)
                d.rectangle([wx, wy, wx + 2, wy + 3], fill=wc + (a,))
    # neon sign on a few buildings
    if random.random() < 0.33:
        sx = x + random.randint(8, max(9, bw - 18))
        sy = top + random.randint(18, max(20, bh // 2))
        sc = random.choice([(255, 70, 130), (80, 230, 255), (255, 170, 70)])
        for i in range(random.randint(3, 6)):
            d.rectangle([sx, sy + i * 5, sx + 2, sy + i * 5 + 2], fill=sc + (190,))
        d.rectangle([sx - 1, sy - 3, sx + 3, sy + 1], fill=sc + (60,))
    x += bw + random.randint(4, 26)

# atmospheric haze at the base
haze = Image.new("RGBA", (W, H), (0, 0, 0, 0))
hd = ImageDraw.Draw(haze)
for y in range(H - 90, H):
    a = int(40 * (1 - (H - y) / 90))
    hd.line([0, y, W, y], fill=(20, 40, 70, a))
near = Image.alpha_composite(near, haze)
make_loop(near).save(OUT / "bg_near.png")

# ---------------------------------------------------------------- title / ending plates
def cinematic(name, group, mul, add, sat, contrast, out):
    im = fit(load(name, group), 480, 270)
    im = grade(im, mul=mul, add=add, contrast=contrast, sat=sat)
    # left-side readability gradient
    ov = Image.new("L", im.size, 0)
    od = ImageDraw.Draw(ov)
    for x in range(im.width):
        od.line([x, 0, x, im.height], fill=int(150 * max(0.0, 1 - x / (im.width * 0.78))))
    im = Image.composite(Image.new("RGB", im.size, (3, 6, 14)), im, ov)
    return quantize(im, 40, Image.Dither.FLOYDSTEINBERG)


title = cinematic("侧颜.png", "角色立绘", (0.55, 0.68, 1.0), (0.01, 0.02, 0.05), 0.7, 1.1, "title_bg.png")
title.save(OUT / "title_bg.png")
ending = cinematic("背影.png", "角色立绘", (0.6, 0.68, 0.95), (0.01, 0.02, 0.06), 0.55, 1.05, "ending_bg.png")
ending.save(OUT / "ending_bg.png")

# ---------------------------------------------------------------- portrait (head crop)
ch = load("chen_3.png", "角色立绘")
crop = ch.crop((590, 10, 910, 330)).resize((128, 128), Image.Resampling.LANCZOS)
crop = grade(crop, mul=(1.0, 1.0, 1.02), contrast=1.04, sat=1.0)
crop = quantize(crop, 48, Image.Dither.FLOYDSTEINBERG)
crop.save(OUT / "portrait.png")

# ---------------------------------------------------------------- preview
preview = Image.new("RGB", (W * 2, H * 2))
far_full = Image.open(OUT / "bg_far.png").crop((0, 0, W, H))
mid_full = Image.open(OUT / "bg_mid.png").crop((0, 0, W, H))
near_full = Image.open(OUT / "bg_near.png").crop((0, 0, W, H))
preview.paste(far_full, (0, 0))
preview.paste(mid_full, (W, 0))
preview.paste(near_full, (0, H))
preview.paste(title.resize((W, H)), (W, H))
preview.save(PREVIEW)

print("bg assets done")
