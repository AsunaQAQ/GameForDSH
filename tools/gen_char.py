# -*- coding: utf-8 -*-
"""Procedural pixel-art sprite sheet for Ch'en (NIGHTFALL demo). 56x56 frames."""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[1] / "assets"
PREVIEW = Path(__file__).resolve().parent / "preview_char.png"
OUT.mkdir(parents=True, exist_ok=True)

S = 56
GROUND = 53
C = {
    "outline": (6, 8, 14),
    "hair_d": (22, 27, 54),
    "hair_m": (42, 54, 100),
    "hair_l": (78, 98, 160),
    "hair_h": (128, 150, 208),
    "skin": (233, 198, 168),
    "skin_d": (196, 151, 121),
    "skin_s": (165, 118, 94),
    "coat_d": (23, 27, 40),
    "coat_m": (46, 55, 78),
    "coat_l": (78, 92, 122),
    "coat_h": (104, 120, 150),
    "white": (218, 219, 222),
    "white_d": (168, 172, 180),
    "red": (166, 38, 48),
    "red_b": (226, 62, 66),
    "red_h": (255, 148, 118),
    "silver": (128, 140, 160),
    "silver_d": (82, 91, 110),
    "orange": (208, 130, 52),
    "orange_h": (252, 196, 108),
}


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def shift(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


class Layer:
    def __init__(self):
        self.im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def rect(self, x0, y0, x1, y1, c):
        self.d.rectangle([x0, y0, x1, y1], fill=rgba(c))

    def px(self, x, y, c):
        if 0 <= x < S and 0 <= y < S:
            self.d.point((x, y), fill=rgba(c))

    def line(self, pts, c, w=1):
        self.d.line([tuple(p) for p in pts], fill=rgba(c), width=w, joint="curve")

    def poly(self, pts, c):
        self.d.polygon([tuple(p) for p in pts], fill=rgba(c))

    def outlined(self, color=C["outline"]):
        alpha = self.im.getchannel("A")
        grown = alpha.filter(ImageFilter.MaxFilter(3))
        edge = Image.eval(grown, lambda v: 255 if v > 0 else 0)
        hole = Image.eval(alpha, lambda v: 255 if v > 0 else 0)
        edge = Image.composite(Image.new("L", (S, S), 0), edge, hole)
        out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        out.paste(Image.new("RGBA", (S, S), rgba(color)), (0, 0), edge)
        return Image.alpha_composite(out, self.im)


def draw_leg(L, hip, foot, near, knee_bend=2):
    """Thigh-high boot leg: shorts, sliver of skin, boot, sole."""
    hx, hy = hip
    fx, fy = foot
    mx = (hx + fx) / 2 + knee_bend
    my = (hy + fy) / 2
    if near:
        boot, boot_d, hi, skin = C["coat_m"], C["coat_d"], C["coat_l"], C["skin"]
        strap, foot_c = C["silver"], C["coat_d"]
    else:
        boot, boot_d, hi, skin = C["coat_d"], (12, 14, 21), C["coat_m"], C["skin_d"]
        strap, foot_c = C["silver_d"], (14, 16, 24)

    # shorts
    L.line([(hx, hy - 1), (hx + (fx - hx) * 0.18, hy + 2)], boot_d, 5)
    # sliver of thigh between shorts and thigh-high boot
    L.rect(hx - 1, hy + 1, hx + 2, hy + 2, skin)
    # boot: thigh -> knee -> ankle
    L.line([(hx, hy + 2), (mx - 1, my - 2)], boot, 4)
    L.line([(mx - 1, my - 2), (fx, fy - 2)], boot, 4)
    # top band + front highlight
    L.line([(hx - 1, hy + 2), (hx + 3, hy + 2)], strap, 1)
    L.line([(int(mx), int(my) - 1), (fx + 1, fy - 3)], hi, 1)
    L.px(int(mx) - 2, int(my) + 1, hi)
    L.px(int(mx), int(my) + 3, boot_d)
    # foot
    L.rect(fx - 2, fy - 2, fx + 2, fy, foot_c)
    L.rect(fx - 2, fy + 1, fx + 2, fy + 1, (9, 10, 15))
    L.px(fx + 3, fy - 1, strap)
    L.px(fx + 2, fy - 2, C["coat_l"])


def draw_horn(L, bx, by, dx, dy, bright):
    tx, ty = bx + dx, by + dy
    L.line([(bx, by), ((bx + tx) // 2, (by + ty) // 2 + 1), (tx, ty)],
           C["orange"], 3)
    L.line([((bx + tx) // 2, (by + ty) // 2 + 1), (tx, ty)], C["orange_h"], 1)
    L.px(tx, ty, (74, 52, 32))
    L.px(tx + 1, ty, (74, 52, 32))
    L.px(bx - 1, by, C["orange_h"] if bright else C["orange"])
    L.px(bx + 1, by + 1, (120, 74, 34))


def draw_char(kind, phase=0.0, bob=0, attack=False, hurt=False):
    back = Layer()
    front = Layer()

    hip_y = 37 + bob
    sh_y = 23 + bob
    hb = bob
    lean = {"run": 1, "dash": 4, "hurt": -2}.get(kind, 0)
    air = kind in ("jump", "fall", "dash")
    hip = (31 + lean // 2, hip_y)

    # ---------------------------------------------------------------- pose
    if kind == "run":
        th = phase * math.tau
        stride, lift = 9.0, 5.0
        fn = (32 + stride * math.sin(th), GROUND - max(0.0, math.cos(th)) * lift)
        ff = (32 + stride * math.sin(th + math.pi), GROUND - max(0.0, math.cos(th + math.pi)) * lift)
        hand = (36 + 4 * math.sin(th + math.pi), sh_y + 8)
        knee_bend_f = 2 + 3 * max(0.0, math.cos(th))
        knee_bend_b = 2 + 3 * max(0.0, -math.cos(th))
    elif kind == "jump":
        fn = (36, 42)
        ff = (25, 48)
        hand = (39, sh_y + 4)
        knee_bend_f, knee_bend_b = 6, 1
    elif kind == "fall":
        fn = (34, 48)
        ff = (24, 44)
        hand = (40, sh_y + 8)
        knee_bend_f, knee_bend_b = 1, 4
    elif kind == "dash":
        fn = (23, 43)
        ff = (18, 49)
        hand = (42, sh_y + 3)
        knee_bend_f, knee_bend_b = 7, 5
    elif hurt:
        fn = (34, 50)
        ff = (26, 51)
        hand = (33, sh_y + 10)
        knee_bend_f, knee_bend_b = 1, 1
    elif attack:
        fn = (35, GROUND)
        ff = (26, GROUND)
        hand = (44, sh_y + 1)
        knee_bend_f, knee_bend_b = 2, 2
    else:
        fn = (37, GROUND)
        ff = (26, GROUND)
        hand = (41, 32 + bob)
        knee_bend_f, knee_bend_b = 2, 2

    # ---------------------------------------------------------------- back half
    draw_leg(back, (hip[0] - 2, hip_y), ff, False, knee_bend_b)

    # coat tails (two panels, behind)
    ct = {"run": 3, "dash": 6, "jump": 5, "fall": 4}.get(kind, 2 if not air else 4)
    back.poly([(28, hip_y - 3), (21, hip_y + 4 + ct), (19, 43 + ct), (23, 42 + ct),
               (29, hip_y + 3)], C["coat_d"])
    back.poly([(30, hip_y - 2), (24, hip_y + 5 + ct), (23, 39 + ct), (27, 38 + ct),
               (31, hip_y + 2)], C["coat_m"])
    back.line([(23, hip_y + 6 + ct), (21, 40 + ct)], (12, 14, 22))
    back.px(22, 37 + ct, C["red"])

    # ponytail
    base = (27, 15 + hb)
    if kind == "dash":
        pts = [base, (21, 12), (14, 13), (9, 18)]
    elif kind == "jump":
        pts = [base, (22, 16), (18, 23), (17, 30)]
    elif kind == "fall":
        pts = [base, (23, 18), (20, 25), (21, 32)]
    elif kind == "run":
        w = math.sin(phase * math.tau) * 2
        pts = [base, (22, 19 + w), (20, 27 + w), (21, 34 + w)]
    else:
        w = math.sin(phase * math.tau) * 1.5
        pts = [base, (23, 19 + w), (21, 27 + w), (22, 36 + w)]
    tx, ty = int(pts[-1][0]), int(pts[-1][1])
    back.poly(pts + [(tx + 5, ty - 2), (tx + 5, ty - 8), (tx + 1, ty - 12),
                     (int(pts[1][0]) + 2, int(pts[1][1]) - 3)], C["hair_d"])
    back.line([pts[0], pts[1], pts[2]], C["hair_m"], 3)
    back.line([(pts[1][0] - 1, pts[1][1] + 1), (pts[2][0] - 1, pts[2][1] + 1)], C["hair_l"])
    back.px(tx + 1, ty - 3, C["hair_l"])

    # far arm
    back.line([(28, sh_y + 2), (24, sh_y + 7), (26, sh_y + 11)], C["coat_d"], 3)
    back.px(26, sh_y + 12, C["skin_d"])

    # ---------------------------------------------------------------- front half
    draw_leg(front, hip, fn, True, knee_bend_f)

    # torso
    front.poly([(28, 22 + hb), (37, 22 + hb), (38, 29 + hb), (36, 36 + hb),
                (30, 36 + hb), (27, 29 + hb)], C["coat_m"])
    front.poly([(28, 22 + hb), (32, 22 + hb), (31, 36 + hb), (30, 36 + hb),
                (27, 29 + hb)], C["coat_d"])
    front.line([(29, 23 + hb), (36, 23 + hb)], C["coat_l"])
    front.px(37, 27 + hb, C["coat_l"])
    front.px(36, 32 + hb, C["coat_l"])
    # white shirt + red tie
    front.poly([(33, 22 + hb), (37, 22 + hb), (36, 30 + hb), (33, 29 + hb)], C["white"])
    front.px(33, 25 + hb, C["white_d"])
    front.poly([(34, 22 + hb), (36, 22 + hb), (35, 28 + hb), (34, 27 + hb)], C["red"])
    front.px(35, 29 + hb, C["red_b"])
    # collar
    front.line([(31, 20 + hb), (33, 22 + hb), (36, 21 + hb), (38, 22 + hb)], C["coat_h"], 2)
    front.px(33, 21 + hb, C["white_d"])
    # belt
    front.rect(30, 33 + hb, 36, 34 + hb, C["silver_d"])
    front.rect(32, 33 + hb, 34, 35 + hb, C["silver"])
    front.px(33, 34 + hb, (44, 48, 60))
    # coat hem points
    front.poly([(36, 31 + hb), (38, 38 + hb), (35, 37 + hb), (35, 32 + hb)], C["coat_m"])
    front.px(37, 37 + hb, C["coat_l"])

    # near arm
    sx, sy = 36 + lean, sh_y + 2
    hx, hy = int(hand[0]), int(hand[1])
    front.line([(sx, sy), (sx + 2, sy + 5), (hx, hy)], C["coat_d"], 4)
    front.line([(sx, sy), (sx + 2, sy + 5), (hx, hy)], C["coat_m"], 2)
    front.px(sx + 1, sy + 2, C["coat_l"])
    front.px(sx + 2, sy + 4, C["coat_l"])
    front.rect(hx - 1, hy - 1, hx + 1, hy + 1, C["coat_d"])
    front.px(hx, hy, C["skin_d"])
    front.px(hx + 1, hy, C["skin"])

    # sword in near hand (not while attacking: the slash fx carries the blade)
    if not attack:
        ang = {"idle": 0.55, "run": 0.9, "jump": 0.35, "fall": 1.15,
               "dash": 0.15, "hurt": 1.35}.get(kind, 0.8)
        bx, by = hx + 1, hy + 2
        ex = bx + int(math.cos(ang) * 12)
        ey = by + int(math.sin(ang) * 12)
        front.line([(bx, by), (ex, ey)], (54, 14, 18), 3)
        front.line([(bx, by), (ex, ey)], C["red"], 2)
        front.line([(bx + 1, by), (ex, ey - 1)], C["red_b"], 1)
        front.px(ex, ey, C["red_h"])
        # guard + grip
        front.line([(bx - 3, by + 1), (bx + 2, by - 2)], C["silver"], 1)
        front.rect(bx - 2, by + 1, bx, by + 3, C["coat_d"])

    # ---------------------------------------------------------------- head
    # horns first: their bases disappear into the hair mass
    draw_horn(front, 30, 11 + hb, -4, -8, True)
    draw_horn(front, 36, 11 + hb, 2, -9, False)
    # back hair mass
    front.poly([(26, 8 + hb), (33, 6 + hb), (38, 8 + hb), (39, 12 + hb), (37, 14 + hb),
                (38, 18 + hb), (35, 21 + hb), (28, 20 + hb), (25, 16 + hb), (24, 11 + hb)],
               C["hair_d"])
    # side lock in front of ear (behind the face)
    front.poly([(30, 12 + hb), (33, 13 + hb), (32, 20 + hb), (30, 20 + hb), (29, 15 + hb)],
               C["hair_m"])
    front.px(31, 16 + hb, C["hair_l"])
    # face (side profile)
    front.poly([(33, 10 + hb), (38, 11 + hb), (39, 16 + hb), (37, 20 + hb),
                (33, 19 + hb), (32, 15 + hb)], C["skin"])
    front.px(38, 16 + hb, C["skin_d"])
    front.px(33, 17 + hb, C["skin_d"])
    front.px(35, 18 + hb, C["skin_d"])
    # bangs
    front.poly([(31, 8 + hb), (38, 8 + hb), (39, 12 + hb), (37, 11 + hb), (35, 14 + hb),
                (34, 11 + hb), (32, 14 + hb), (31, 11 + hb)], C["hair_m"])
    front.line([(27, 9 + hb), (33, 7 + hb), (37, 9 + hb)], C["hair_l"])
    front.px(30, 8 + hb, C["hair_h"])
    front.px(35, 9 + hb, C["hair_h"])
    # eye, nose, mouth
    front.line([(34, 13 + hb), (37, 13 + hb)], C["hair_d"])
    front.px(35, 14 + hb, C["outline"])
    front.px(36, 14 + hb, C["red_b"])
    front.px(36, 15 + hb, C["red"])
    front.px(37, 17 + hb, C["skin_s"])
    front.px(37, 18 + hb, C["skin_d"])

    frame = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    frame = Image.alpha_composite(frame, back.outlined())
    frame = Image.alpha_composite(frame, front.outlined())
    return frame


# -------------------------------------------------------------------- frames
frames, names = [], []
for i, b in enumerate([0, 0, 1, 0]):
    frames.append(draw_char("idle", phase=i / 4, bob=b))
    names.append(f"idle{i}")
for i in range(6):
    frames.append(draw_char("run", phase=i / 6))
    names.append(f"run{i}")
frames.append(draw_char("jump")); names.append("jump")
frames.append(draw_char("fall")); names.append("fall")
frames.append(draw_char("dash")); names.append("dash")
frames.append(draw_char("hurt", hurt=True)); names.append("hurt")
frames.append(draw_char("idle", attack=True)); names.append("atk0")
frames.append(draw_char("run", phase=0.25, attack=True)); names.append("atk1")

COLS = 8
ROWS = math.ceil(len(frames) / COLS)
sheet = Image.new("RGBA", (COLS * S, ROWS * S), (0, 0, 0, 0))
for i, f in enumerate(frames):
    sheet.paste(f, ((i % COLS) * S, (i // COLS) * S), f)
sheet.save(OUT / "chen_sheet.png")

# neon rim light sheet: a 1px halo just outside every frame
rim_sheet = Image.new("RGBA", sheet.size, (0, 0, 0, 0))
for i, f in enumerate(frames):
    alpha = f.getchannel("A")
    grown = alpha.filter(ImageFilter.MaxFilter(3))
    edge = Image.new("L", (S, S), 0)
    ep = edge.load()
    gp = grown.load()
    ap = alpha.load()
    for y in range(S):
        for x in range(S):
            if gp[x, y] > 0 and ap[x, y] == 0:
                ep[x, y] = 200
    rim = Image.new("RGBA", (S, S), (120, 190, 255, 255))
    rim.putalpha(edge)
    rim_sheet.paste(rim, ((i % COLS) * S, (i // COLS) * S), rim)
rim_sheet.save(OUT / "chen_rim.png")

# -------------------------------------------------------------------- slash fx
SW = 72
slash_frames = []
for i in range(4):
    im = Image.new("RGBA", (SW, SW), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = 34, 30
    start = -1.95 + i * 0.12
    span = 0.5 + i * 0.55
    r_out = 19 + i * 3
    n = 110
    fade = (1.0, 1.0, 1.0, 0.65)[i]
    for k in range(n):
        t = k / (n - 1)
        a = start + span * t
        taper = math.sin(math.pi * min(1.0, max(0.0, t))) ** 0.6
        half = int(1 + 3.2 * taper)
        for o in range(-half, half + 1):
            rr = r_out + o
            x = int(cx + math.cos(a) * rr)
            y = int(cy + math.sin(a) * rr)
            if abs(o) >= half - 1:
                col = rgba((110, 24, 34), int(180 * fade))
            elif abs(o) <= 1 and 0.15 < t < 0.9:
                col = rgba((255, 214, 186), int(235 * fade))
            elif o < 0:
                col = rgba(C["red_b"], int(220 * fade))
            else:
                col = rgba((120, 26, 36), int(200 * fade))
            d.point((x, y), fill=col)
        if k % 9 == 0 and 0.2 < t < 0.9:
            rr = r_out + half + 2
            x = int(cx + math.cos(a) * rr)
            y = int(cy + math.sin(a) * rr)
            d.point((x, y), fill=rgba((255, 238, 214), int(200 * fade)))
    # blade wedge leading the arc
    a = start + span
    for t in range(5, r_out + 4):
        w = max(0, (r_out + 4 - t) // 10)
        x = int(cx + math.cos(a) * t)
        y = int(cy + math.sin(a) * t)
        d.line([(x - w, y), (x + w, y)], fill=rgba((255, 226, 200), int(210 * fade)))
    slash_frames.append(im)
    im.save(OUT / f"slash_{i}.png")

# -------------------------------------------------------------------- preview
scale = 5
pad = 14
cellw, cellh = S * scale + pad, S * scale + pad + 12
prev = Image.new("RGB", (cellw * COLS, cellh * ROWS + 30), (18, 22, 34))
pd = ImageDraw.Draw(prev)
for i, f in enumerate(frames):
    cx, cy = (i % COLS) * cellw, (i // COLS) * cellh
    big = f.resize((S * scale, S * scale), Image.Resampling.NEAREST)
    prev.paste(big, (cx, cy + 18), big)
    pd.text((cx + 4, cy + 4), names[i], fill=(150, 180, 220))
prev.save(PREVIEW)

zoom = Image.new("RGB", (S * 10, S * 10), (20, 25, 38))
big = frames[0].resize((S * 10, S * 10), Image.Resampling.NEAREST)
zoom.paste(big, (0, 0), big)
zoom.save(Path(__file__).resolve().parent / "zoom.png")

slash_prev = Image.new("RGB", (SW * 4 * 2 + 50, SW * 2 + 30), (18, 22, 34))
for i, f in enumerate(slash_frames):
    big = f.resize((SW * 2, SW * 2), Image.Resampling.NEAREST)
    slash_prev.paste(big, (i * (SW * 2 + 10) + 5, 20), big)
slash_prev.save(Path(__file__).resolve().parent / "preview_slash.png")

print("frames", len(frames), "sheet", sheet.size)
