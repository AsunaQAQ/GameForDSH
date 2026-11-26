# -*- coding: utf-8 -*-
"""Tile atlas + small props for NIGHTFALL. 16x16 cells, 8 columns."""
import random
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "assets"
PREVIEW = Path(__file__).resolve().parent / "preview_tiles.png"
OUT.mkdir(parents=True, exist_ok=True)

T = 16
COLS, ROWS = 8, 2
C = {
    "void": (8, 10, 18),
    "base": (28, 34, 50),
    "base_d": (20, 25, 38),
    "base_l": (43, 52, 73),
    "rim": (68, 84, 112),
    "rim_h": (110, 133, 168),
    "cyan": (86, 214, 235),
    "cyan_d": (36, 118, 138),
    "pink": (235, 82, 132),
    "amber": (235, 168, 90),
    "steel": (80, 92, 112),
    "steel_d": (46, 54, 70),
    "white": (200, 206, 214),
    "red": (168, 44, 52),
}


def cell():
    return Image.new("RGBA", (T, T), (0, 0, 0, 0))


def px(d, x, y, c, a=255):
    d.point((x, y), fill=(c[0], c[1], c[2], a))


def rect(d, x0, y0, x1, y1, c, a=255):
    d.rectangle([x0, y0, x1, y1], fill=(c[0], c[1], c[2], a))


def concrete(seed):
    im = cell()
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    rect(d, 0, 0, 15, 15, C["base"])
    # panel seams
    rect(d, 0, 0, 15, 0, C["base_l"])
    rect(d, 0, 15, 15, 15, C["base_d"])
    rect(d, 0, 0, 0, 15, C["base_l"])
    rect(d, 15, 0, 15, 15, C["base_d"])
    # rivets
    for (x, y) in ((2, 2), (13, 2), (2, 13), (13, 13)):
        if rnd.random() < 0.8:
            px(d, x, y, C["rim"])
    # grime
    for _ in range(rnd.randint(4, 9)):
        x, y = rnd.randint(1, 14), rnd.randint(2, 14)
        px(d, x, y, C["base_d"] if rnd.random() < 0.6 else C["base_l"])
    return im


def bricks(seed):
    im = cell()
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    rect(d, 0, 0, 15, 15, C["base_d"])
    for row in range(4):
        y = row * 4
        offset = 2 if row % 2 else 0
        for bx in range(-8, 16, 8):
            x = bx + offset
            rect(d, x, y, min(15, x + 6), y + 2, C["base"])
            px(d, min(15, x + 6), y, C["base_l"])
    for _ in range(5):
        px(d, rnd.randint(0, 15), rnd.randint(1, 15), C["base_l"])
    return im


def corrugated(seed):
    im = cell()
    d = ImageDraw.Draw(im)
    rect(d, 0, 0, 15, 15, C["base"])
    for x in range(0, 16, 4):
        rect(d, x, 0, x, 15, C["base_d"])
        rect(d, x + 1, 0, x + 1, 15, C["base_l"])
    rect(d, 0, 7, 15, 8, C["steel_d"])
    for x in (3, 11):
        px(d, x, 7, C["steel"])
    return im


def vent(seed):
    im = concrete(seed)
    d = ImageDraw.Draw(im)
    rect(d, 3, 3, 13, 12, C["base_d"])
    for y in range(4, 12, 2):
        rect(d, 4, y, 12, y, C["steel_d"])
    rect(d, 3, 3, 13, 3, C["steel"])
    return im


def window(seed):
    im = concrete(seed)
    d = ImageDraw.Draw(im)
    rect(d, 2, 2, 13, 12, (14, 18, 28))
    rect(d, 3, 3, 12, 11, (34, 42, 60))
    rect(d, 4, 4, 7, 9, C["cyan_d"])
    px(d, 5, 5, C["cyan"])
    px(d, 6, 6, C["cyan"])
    rect(d, 8, 3, 8, 11, C["base_d"])
    rect(d, 3, 11, 12, 11, C["base_d"])
    return im


def hazard(seed):
    im = cell()
    d = ImageDraw.Draw(im)
    rect(d, 0, 0, 15, 15, (36, 32, 30))
    for i in range(-16, 32, 8):
        for t in range(4):
            for y in range(16):
                x = i + y
                if 0 <= x < 16 and 6 <= y <= 12:
                    px(d, x, y, C["amber"] if (i // 4) % 2 == 0 else (28, 26, 28))
    rect(d, 0, 0, 15, 1, C["steel_d"])
    rect(d, 0, 15, 15, 15, C["steel_d"])
    return im


def rubble(seed):
    im = concrete(seed)
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed + 9)
    for _ in range(9):
        x, y = rnd.randint(1, 14), rnd.randint(1, 14)
        rect(d, x, y, x + rnd.randint(0, 2), y + rnd.randint(0, 1), C["base_d"])
    return im


def platform(piece):
    im = cell()
    d = ImageDraw.Draw(im)
    if piece == 0:
        rect(d, 1, 2, 15, 8, C["steel_d"])
        rect(d, 1, 2, 15, 3, C["steel"])
        rect(d, 1, 4, 15, 4, C["rim"])
        px(d, 2, 6, C["steel"])
        px(d, 2, 5, C["steel"])
        rect(d, 4, 9, 5, 12, C["steel_d"])
        rect(d, 2, 2, 2, 8, C["steel"])
    elif piece == 1:
        rect(d, 0, 2, 15, 8, C["steel_d"])
        rect(d, 0, 2, 15, 3, C["steel"])
        rect(d, 0, 4, 15, 4, C["rim"])
        for x in (4, 12):
            rect(d, x, 5, x, 8, C["steel"])
        rect(d, 0, 8, 15, 8, C["steel"])
        # cyan strip
        rect(d, 2, 9, 13, 9, C["cyan_d"])
    else:
        rect(d, 0, 2, 14, 8, C["steel_d"])
        rect(d, 0, 2, 14, 3, C["steel"])
        rect(d, 0, 4, 14, 4, C["rim"])
        rect(d, 0, 2, 0, 8, C["steel"])
        rect(d, 11, 9, 12, 12, C["steel_d"])
        px(d, 14, 8, C["base_d"])
    return im


def spike():
    im = cell()
    d = ImageDraw.Draw(im)
    rect(d, 0, 11, 15, 15, C["steel_d"])
    rect(d, 0, 11, 15, 11, C["steel"])
    for i, x in enumerate((1, 6, 11)):
        for k in range(5):
            rect(d, x + k, 11 - (5 - k) * 2, x + 9 - k, 11 - (5 - k) * 2, C["steel"])
            px(d, x + k + 2, 11 - (5 - k) * 2 + 1, C["white"])
        px(d, x + 2, 1, C["white"])
    return im


def crate():
    im = cell()
    d = ImageDraw.Draw(im)
    rect(d, 1, 1, 14, 14, (38, 34, 34))
    rect(d, 1, 1, 14, 2, (82, 70, 60))
    rect(d, 1, 1, 2, 14, (70, 60, 52))
    rect(d, 13, 1, 14, 14, (28, 24, 24))
    rect(d, 1, 13, 14, 14, (28, 24, 24))
    rect(d, 3, 7, 12, 8, C["red"])
    px(d, 4, 4, C["amber"])
    px(d, 11, 11, C["amber"])
    return im


def pillar():
    im = cell()
    d = ImageDraw.Draw(im)
    rect(d, 4, 0, 11, 15, C["base"])
    rect(d, 4, 0, 4, 15, C["base_l"])
    rect(d, 11, 0, 11, 15, C["base_d"])
    rect(d, 6, 0, 6, 15, C["cyan_d"])
    px(d, 6, 3, C["cyan"])
    px(d, 6, 9, C["cyan"])
    rect(d, 3, 0, 12, 0, C["steel_d"])
    return im


def sign():
    im = cell()
    d = ImageDraw.Draw(im)
    rect(d, 3, 2, 12, 13, (12, 15, 24))
    rect(d, 3, 2, 12, 3, C["steel_d"])
    for y in (5, 8, 11):
        rect(d, 5, y, 10, y, C["pink"])
    px(d, 10, 5, C["white"])
    px(d, 5, 8, C["white"])
    px(d, 6, 11, C["white"])
    return im


def chain():
    im = cell()
    d = ImageDraw.Draw(im)
    for y in range(0, 16, 4):
        rect(d, 7, y, 8, y + 2, C["steel_d"])
        px(d, 6, y + 2, C["steel"])
        px(d, 9, y + 2, C["steel"])
    return im


builders = [
    lambda: concrete(1), lambda: concrete(7), lambda: bricks(3), lambda: corrugated(5),
    lambda: vent(6), lambda: window(4), lambda: hazard(2), lambda: rubble(8),
    lambda: platform(0), lambda: platform(1), lambda: platform(2), spike,
    crate, pillar, sign, chain,
]
sheet = Image.new("RGBA", (COLS * T, ROWS * T), (0, 0, 0, 0))
for i, b in enumerate(builders):
    tile = b()
    sheet.paste(tile, ((i % COLS) * T, (i // COLS) * T), tile)
sheet.save(OUT / "tiles.png")

# preview on a dark backdrop at 6x
scale = 6
prev = Image.new("RGB", (COLS * T * scale, ROWS * T * scale + 20), (13, 16, 26))
big = sheet.resize((sheet.width * scale, sheet.height * scale), Image.Resampling.NEAREST)
prev.paste(big, (0, 20), big)
prev.save(PREVIEW)
print("tiles ok")
