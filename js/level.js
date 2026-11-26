/* NIGHTFALL — level data, static world rendering, bitmap font */
(function () {
  'use strict';

  const T = 16;
  const W = 224;
  const H = 36;
  const grid = new Uint8Array(W * H);

  const idx = (x, y) => y * W + x;

  const fonts = {
    A: ['0110', '1001', '1111', '1001', '1001'],
    B: ['1110', '1001', '1110', '1001', '1110'],
    C: ['0111', '1000', '1000', '1000', '0111'],
    D: ['1110', '1001', '1001', '1001', '1110'],
    E: ['1111', '1000', '1110', '1000', '1111'],
    F: ['1111', '1000', '1110', '1000', '1000'],
    G: ['0111', '1000', '1011', '1001', '0111'],
    H: ['1001', '1001', '1111', '1001', '1001'],
    I: ['1110', '0100', '0100', '0100', '1110'],
    J: ['0011', '0001', '0001', '1001', '0110'],
    K: ['1001', '1010', '1100', '1010', '1001'],
    L: ['1000', '1000', '1000', '1000', '1111'],
    M: ['1001', '1111', '1111', '1001', '1001'],
    N: ['1001', '1101', '1111', '1011', '1001'],
    O: ['0110', '1001', '1001', '1001', '0110'],
    P: ['1110', '1001', '1110', '1000', '1000'],
    Q: ['0110', '1001', '1001', '1011', '0111'],
    R: ['1110', '1001', '1110', '1010', '1001'],
    S: ['0111', '1000', '0110', '0001', '1110'],
    T: ['1111', '0100', '0100', '0100', '0100'],
    U: ['1001', '1001', '1001', '1001', '1111'],
    V: ['1001', '1001', '1001', '1010', '0100'],
    W: ['1001', '1001', '1111', '1111', '1001'],
    X: ['1001', '1001', '0110', '1001', '1001'],
    Y: ['1010', '1010', '0100', '0100', '0100'],
    Z: ['1111', '0010', '0100', '1000', '1111'],
    '0': ['0110', '1001', '1001', '1001', '0110'],
    '1': ['0100', '1100', '0100', '0100', '1110'],
    '2': ['0110', '1001', '0010', '0100', '1111'],
    '3': ['1110', '0001', '0110', '0001', '1110'],
    '4': ['0010', '0110', '1010', '1111', '0010'],
    '5': ['1111', '1000', '1110', '0001', '1110'],
    '6': ['0110', '1000', '1110', '1001', '0110'],
    '7': ['1111', '0001', '0010', '0100', '0100'],
    '8': ['0110', '1001', '0110', '1001', '0110'],
    '9': ['0110', '1001', '0111', '0001', '0110'],
    '-': ['0000', '0000', '1111', '0000', '0000'],
    '.': ['0000', '0000', '0000', '0000', '0100'],
    ':': ['0000', '0100', '0000', '0100', '0000'],
    ' ': ['0000', '0000', '0000', '0000', '0000'],
  };

  function textWidth(text, scale) {
    const n = String(text).length;
    return n <= 0 ? 0 : (n * 5 - 1) * scale;
  }

  function drawText(g, text, x, y, scale, color, shadow) {
    const s = String(text).toUpperCase();
    if (shadow) {
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const glyph = fonts[ch] || fonts[' '];
        for (let gy = 0; gy < 5; gy++) {
          for (let gx = 0; gx < 4; gx++) {
            if (glyph[gy][gx] === '1') {
              g.fillStyle = shadow;
              g.fillRect(x + i * 5 * scale + gx * scale, y + gy * scale + scale, scale, scale);
            }
          }
        }
      }
    }
    g.fillStyle = color;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const glyph = fonts[ch] || fonts[' '];
      for (let gy = 0; gy < 5; gy++) {
        for (let gx = 0; gx < 4; gx++) {
          if (glyph[gy][gx] === '1') {
            g.fillRect(x + i * 5 * scale + gx * scale, y + gy * scale, scale, scale);
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------ map build
  function fill(x0, y0, x1, y1, v) {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
        grid[idx(x, y)] = v;
      }
    }
  }
  const floorTo = (x0, x1, top) => fill(x0, top, x1, H - 1, 1);
  const box = (x0, y0, x1, y1) => fill(x0, y0, x1, y1, 1);
  const oneway = (x0, x1, y) => fill(x0, y, x1, y, 2);

  // street A
  floorTo(0, 34, 27);
  oneway(13, 17, 23);
  oneway(22, 26, 23);
  oneway(27, 31, 20);

  // alley
  floorTo(38, 55, 26);
  oneway(43, 47, 22);
  oneway(49, 52, 24);

  // lower alley + climb out
  floorTo(56, 74, 33);
  oneway(64, 67, 30);
  oneway(68, 71, 27);

  // upper street
  floorTo(74, 96, 26);
  oneway(80, 84, 23);

  // ascent
  oneway(95, 99, 22);
  oneway(101, 105, 18);
  oneway(107, 111, 14);
  box(113, 13, 127, 17);

  // descent
  oneway(128, 131, 16);
  oneway(133, 136, 19);
  floorTo(136, 160, 25);

  // broken overpass
  oneway(160, 163, 22);
  oneway(165, 168, 20);

  // final block
  floorTo(168, 224, 24);

  // a little alcove above the gate side
  oneway(185, 190, 20);
  oneway(192, 196, 18);

  const get = (tx, ty) => {
    if (tx < 0 || tx >= W) return 1;
    if (ty < 0) return 0;
    if (ty >= H) return 0;
    return grid[idx(tx, ty)];
  };

  const spawn = { x: 4 * T + 8, y: 27 * T };

  const backwalls = [
    { x0: 0, x1: 34, top: 23, bottom: 27, style: 0 },
    { x0: 38, x1: 55, top: 21, bottom: 26, style: 1 },
    { x0: 56, x1: 74, top: 29, bottom: 33, style: 2 },
    { x0: 74, x1: 96, top: 23, bottom: 26, style: 0 },
    { x0: 113, x1: 127, top: 9, bottom: 13, style: 3 },
    { x0: 136, x1: 160, top: 21, bottom: 25, style: 1 },
    { x0: 168, x1: 200, top: 22, bottom: 24, style: 0 },
    { x0: 200, x1: 224, top: 20, bottom: 24, style: 2 },
  ];

  const signs = [
    { x: 6, y: 23, text: 'NIGHTFALL', color: '#ff4f8b', scale: 1 },
    { x: 20, y: 23, text: 'LONG MEN', color: '#6fe7ff', scale: 1 },
    { x: 44, y: 21, text: 'NO ENTRY', color: '#ffb45c', scale: 1 },
    { x: 58, y: 29, text: 'CORE 02', color: '#ffb45c', scale: 1 },
    { x: 84, y: 17, text: 'B-7', color: '#ff4f8b', scale: 3 },
    { x: 150, y: 21, text: '9TH DIST', color: '#6fe7ff', scale: 1 },
    { x: 176, y: 22, text: 'EXIT', color: '#6dffb0', scale: 2 },
    { x: 203, y: 17, text: 'EXTRACTION', color: '#6dffb0', scale: 1 },
  ].map((s) => ({ ...s, px: s.x * T, py: s.y * T }));

  const lamps = [
    { x: 11 * T + 6, y: 27 * T, color: '#ffb45c', h: 42 },
    { x: 31 * T + 4, y: 27 * T, color: '#6fe7ff', h: 36 },
    { x: 60 * T + 6, y: 33 * T, color: '#ff8a5c', h: 34 },
    { x: 78 * T + 6, y: 26 * T, color: '#6fe7ff', h: 40 },
    { x: 142 * T + 6, y: 25 * T, color: '#ffb45c', h: 38 },
    { x: 174 * T + 6, y: 24 * T, color: '#ff4f8b', h: 40 },
    { x: 208 * T + 4, y: 24 * T, color: '#6dffb0', h: 46 },
  ];

  const neonEdges = [
    { x0: 1, x1: 20, y: 27, color: '#ff4f8b', phase: 0.2 },
    { x0: 23, x1: 33, y: 27, color: '#6fe7ff', phase: 1.1 },
    { x0: 13, x1: 17, y: 23, color: '#6fe7ff', phase: 0.4 },
    { x0: 27, x1: 31, y: 20, color: '#ffb45c', phase: 2.0 },
    { x0: 39, x1: 55, y: 26, color: '#ff4f8b', phase: 1.6 },
    { x0: 57, x1: 73, y: 33, color: '#ffb45c', phase: 0.8 },
    { x0: 75, x1: 95, y: 26, color: '#6fe7ff', phase: 0.5 },
    { x0: 113, x1: 127, y: 13, color: '#6fe7ff', phase: 1.2 },
    { x0: 137, x1: 159, y: 25, color: '#ff4f8b', phase: 0.1 },
    { x0: 169, x1: 199, y: 24, color: '#6fe7ff', phase: 2.2 },
    { x0: 201, x1: 215, y: 24, color: '#6dffb0', phase: 1.4 },
  ].map((n) => ({ ...n, x0px: n.x0 * T, x1px: n.x1 * T, ypx: n.y * T }));

  const spikes = [
    { x0: 60, x1: 62, y: 32 },
    { x0: 146, x1: 149, y: 24 },
  ];

  const crates = [
    { x: 8, y: 26 }, { x: 9, y: 26 }, { x: 9, y: 25 },
    { x: 52, y: 25 }, { x: 154, y: 24 }, { x: 180, y: 23 },
  ];

  const cables = [
    { x: 16, y: 12, len: 42 }, { x: 30, y: 12, len: 55 },
    { x: 48, y: 10, len: 38 }, { x: 66, y: 17, len: 30 },
    { x: 88, y: 10, len: 48 }, { x: 144, y: 9, len: 36 },
    { x: 156, y: 9, len: 52 }, { x: 184, y: 6, len: 44 },
  ];

  // dynamic template data
  const TPL = {
    cores: [
      { x: 29 * T + 8, y: 18 * T + 8, id: 0 },
      { x: 66 * T + 8, y: 31 * T + 8, id: 1 },
      { x: 120 * T + 8, y: 11 * T + 8, id: 2 },
    ],
    enemies: [
      { x: 48 * T, y: 22 * T, min: 44 * T, max: 54 * T, dir: 1, hp: 2 },
      { x: 64 * T, y: 29 * T, min: 58 * T, max: 72 * T, dir: -1, hp: 2 },
      { x: 90 * T, y: 21 * T, min: 84 * T, max: 94 * T, dir: 1, hp: 2 },
      { x: 120 * T, y: 10 * T, min: 114 * T, max: 126 * T, dir: 1, hp: 2 },
      { x: 148 * T, y: 21 * T, min: 141 * T, max: 157 * T, dir: 1, hp: 2 },
      { x: 182 * T, y: 20 * T, min: 173 * T, max: 194 * T, dir: -1, hp: 2 },
    ],
    checkpoints: [
      { x: 80 * T + 8, y: 26 * T, id: 0 },
      { x: 140 * T + 8, y: 25 * T, id: 1 },
    ],
    gate: { x: 201 * T, y: 19 * T, w: 4 * T, h: 5 * T },
  };

  const level = {
    W, H, T, grid, get, spawn, signs, lamps, neonEdges, spikes, crates, cables, backwalls,
    TPL,
    fontDraw: drawText,
    cores: [],
    enemies: [],
    checkpoints: [],
    gate: null,
    world: null,

    reset() {
      this.cores = TPL.cores.map((c) => ({ ...c, taken: false, bob: Math.random() * 6 }));
      this.enemies = TPL.enemies.map((e) => ({
        ...e, alive: true, hit: 0, bob: Math.random() * 6,
      }));
      this.checkpoints = TPL.checkpoints.map((c) => ({ ...c, active: false }));
      this.gate = { ...TPL.gate, open: false, openT: 0 };
      return this;
    },

    buildWorld(tilesImg) {
      const cv = document.createElement('canvas');
      cv.width = W * T;
      cv.height = H * T;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;

      drawBackwalls(g);
      drawCables(g);
      drawTiles(g, tilesImg);
      drawWet(g);
      drawCrates(g, tilesImg);
      drawLampPoles(g);
      drawSignPanels(g);

      this.world = cv;
      return cv;
    },
  };

  // ------------------------------------------------------------------ rendering
  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return (h ^ (h >>> 16)) >>> 0;
  }

  function drawBackwalls(g) {
    for (const bw of backwalls) {
      const x0 = bw.x0 * T;
      const x1 = bw.x1 * T;
      const y0 = bw.top * T;
      const y1 = bw.bottom * T;
      const w = x1 - x0;
      const hgt = y1 - y0;
      const bwHash = hash(bw.x0, bw.top);

      g.fillStyle = 'rgba(7, 11, 20, 0.74)';
      g.fillRect(x0, y0, w, hgt);
      // stepped roofline so it does not read as a flat wall
      for (let i = 0; i < 5; i++) {
        const rx = x0 + (hash(bw.x0 + i, bw.top) % Math.max(8, w - 36));
        const rw = 18 + (hash(bw.x0 + i, bw.top + 3) % 30);
        const rh = 6 + (hash(i, bw.x0) % 18);
        g.fillRect(rx, y0 - rh, Math.min(rw, x1 - rx), rh + 2);
      }
      // panel seams
      g.fillStyle = 'rgba(28, 38, 58, 0.45)';
      for (let x = x0 + 24; x < x1; x += 32) g.fillRect(x, y0, 1, hgt);
      g.fillStyle = 'rgba(4, 7, 14, 0.45)';
      for (let y = y0 + 28; y < y1; y += 36) g.fillRect(x0, y, w, 1);
      // top rim
      g.fillStyle = 'rgba(52, 68, 96, 0.7)';
      g.fillRect(x0, y0, w, 2);
      g.fillStyle = 'rgba(90, 120, 160, 0.45)';
      g.fillRect(x0, y0, w, 1);

      // windows
      const lit = ['#6fe7ff', '#ffb45c', '#ff4f8b', '#9fd0ff'];
      for (let wy = y0 + 14; wy < y1 - 14; wy += 26) {
        for (let wx = x0 + 10; wx < x1 - 12; wx += 28) {
          const hv = hash(wx, wy);
          const on = (hv % 100) < 20;
          g.fillStyle = 'rgba(3, 6, 12, 0.55)';
          g.fillRect(wx, wy, 11, 14);
          if (on) {
            const c = lit[hv % lit.length];
            g.globalAlpha = 0.14 + ((hv >>> 8) % 18) / 100;
            g.fillStyle = c;
            g.fillRect(wx + 1, wy + 1, 9, 12);
            g.globalAlpha = 1;
            g.fillStyle = 'rgba(2, 5, 10, 0.6)';
            g.fillRect(wx + 5, wy + 1, 1, 7);
          } else {
            g.fillStyle = 'rgba(18, 26, 40, 0.6)';
            g.fillRect(wx + 2, wy + 2, 7, 10);
          }
        }
      }

      // vertical neon strip
      if (bwHash % 2 === 0) {
        const nx = x0 + 18 + (bwHash % (Math.max(20, w - 36)));
        const col = ['#ff4f8b', '#6fe7ff', '#ffb45c'][bwHash % 3];
        g.fillStyle = 'rgba(6, 9, 16, 0.9)';
        g.fillRect(nx - 2, y0 + 10, 10, hgt - 24);
        g.globalAlpha = 0.65;
        g.fillStyle = col;
        g.fillRect(nx, y0 + 14, 2, hgt - 34);
        g.globalAlpha = 1;
      }

      // ground shadow gradient
      const grad = g.createLinearGradient(0, y1 - 60, 0, y1);
      grad.addColorStop(0, 'rgba(2, 4, 9, 0)');
      grad.addColorStop(1, 'rgba(2, 4, 9, 0.75)');
      g.fillStyle = grad;
      g.fillRect(x0, y1 - 60, w, 60);

      // roof furniture
      if (bw.style !== 3) {
        const ax = x0 + 40 + (bwHash % Math.max(10, w - 60));
        g.fillStyle = 'rgba(6, 10, 18, 0.95)';
        g.fillRect(ax, y0 - 26, 3, 26);
        g.fillRect(ax - 8, y0 - 18, 19, 2);
        g.fillRect(ax + 1, y0 - 26, 8, 2);
      }
    }
  }

  function hexToRgba(hex, a) {
    const v = parseInt(hex.slice(1), 16);
    return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
  }

  function drawWet(g) {
    for (const n of neonEdges) {
      const grad = g.createLinearGradient(0, n.ypx + 1, 0, n.ypx + 24);
      grad.addColorStop(0, hexToRgba(n.color, 0.09));
      grad.addColorStop(0.45, hexToRgba(n.color, 0.022));
      grad.addColorStop(1, hexToRgba(n.color, 0));
      g.fillStyle = grad;
      g.fillRect(n.x0px, n.ypx + 1, n.x1px - n.x0px, 24);
      for (let x = n.x0px + 5; x < n.x1px - 8; x += 17) {
        const hv = hash(x, n.ypx) % 13;
        g.fillStyle = hexToRgba(n.color, 0.07);
        g.fillRect(x, n.ypx + 5 + hv, 7, 1);
        g.fillStyle = hexToRgba(n.color, 0.04);
        g.fillRect(x + 3, n.ypx + 10 + (hv % 11), 12, 1);
      }
    }
    for (const l of lamps) {
      const rgb = l.color === '#ffb45c' ? '255,180,92' : l.color === '#ff4f8b' ? '255,79,139' : '111,231,255';
      const gr = g.createRadialGradient(l.x, l.y - 2, 1, l.x, l.y - 2, 34);
      gr.addColorStop(0, `rgba(${rgb},0.16)`);
      gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr;
      g.fillRect(l.x - 34, l.y - 34, 68, 36);
    }
  }

  function drawTiles(g, img) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = grid[idx(x, y)];
        if (!v) continue;
        const px = x * T;
        const py = y * T;
        const up = get(x, y - 1);
        const down = get(x, y + 1);
        const left = get(x - 1, y);
        const right = get(x + 1, y);

        if (v === 1) {
          const h = hash(x, y);
          let variant = 0;
          if (h % 13 === 0) variant = 3;
          else if (h % 11 === 0) variant = 2;
          else if (h % 7 === 0) variant = 1;
          else if (h % 17 === 0) variant = 4;
          const sx = (variant % 8) * T;
          const sy = Math.floor(variant / 8) * T;
          g.drawImage(img, sx, sy, T, T, px, py, T, T);

          if (!up || up === 2) {
            g.fillStyle = '#2c3850';
            g.fillRect(px, py, T, 3);
            g.fillStyle = '#5b6f8e';
            g.fillRect(px, py, T, 1);
            g.fillStyle = '#141a27';
            g.fillRect(px, py + 3, T, 1);
            // tiny deck marks
            if (h % 9 === 0) {
              g.fillStyle = '#788caa';
              g.fillRect(px + 4, py + 1, 2, 1);
              g.fillRect(px + 10, py + 1, 1, 1);
            }
          }
          if (!left) {
            g.fillStyle = 'rgba(74, 92, 120, 0.8)';
            g.fillRect(px, py, 1, T);
            g.fillStyle = 'rgba(8, 11, 18, 0.6)';
            g.fillRect(px + 1, py, 1, T);
          }
          if (!right) {
            g.fillStyle = 'rgba(6, 9, 16, 0.8)';
            g.fillRect(px + T - 1, py, 1, T);
          }
          if (!down) {
            g.fillStyle = 'rgba(5, 7, 13, 0.85)';
            g.fillRect(px, py + T - 2, T, 2);
          }
        } else if (v === 2) {
          const pieceLeft = grid[idx(Math.max(0, x - 1), y)] === 2;
          const pieceRight = grid[idx(Math.min(W - 1, x + 1), y)] === 2;
          let variant = 9;
          if (!pieceLeft) variant = 8;
          else if (!pieceRight) variant = 10;
          const sx = (variant % 8) * T;
          const sy = Math.floor(variant / 8) * T;
          g.drawImage(img, sx, sy, T, T, px, py, T, T);
          g.fillStyle = 'rgba(4, 7, 12, 0.55)';
          g.fillRect(px, py + T - 3, T, 3);
        }
      }
    }

    // spikes
    for (const sp of spikes) {
      for (let x = sp.x0; x <= sp.x1; x++) {
        g.drawImage(img, 11 * T, T, T, T, x * T, sp.y * T, T, T);
      }
    }

    // neon edge base lines (glow added live)
    for (const n of neonEdges) {
      g.fillStyle = n.color;
      g.globalAlpha = 0.5;
      g.fillRect(n.x0px, n.ypx, n.x1px - n.x0px, 1);
      g.globalAlpha = 1;
    }
  }

  function drawCrates(g, img) {
    for (const c of crates) {
      g.globalAlpha = 0.92;
      g.drawImage(img, 12 * T, T, T, T, c.x * T, c.y * T, T, T);
      g.globalAlpha = 1;
    }
  }

  function drawLampPoles(g) {
    for (const l of lamps) {
      g.fillStyle = '#0b0f18';
      g.fillRect(l.x - 1, l.y - l.h, 3, l.h);
      g.fillStyle = '#1c2534';
      g.fillRect(l.x - 1, l.y - l.h, 1, l.h);
      g.fillStyle = '#263246';
      g.fillRect(l.x - 5, l.y - l.h - 3, 11, 3);
      g.fillStyle = '#3a4a66';
      g.fillRect(l.x - 5, l.y - l.h - 3, 11, 1);
      g.fillStyle = l.color;
      g.globalAlpha = 0.9;
      g.fillRect(l.x - 3, l.y - l.h, 7, 2);
      g.globalAlpha = 1;
    }
  }

  function drawCables(g) {
    for (const c of cables) {
      const x0 = c.x * T;
      const y0 = c.y * T;
      g.strokeStyle = 'rgba(5, 8, 14, 0.9)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x0, y0);
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const sag = Math.sin(Math.PI * t) * c.len;
        g.lineTo(x0 + t * 2, y0 + sag);
      }
      g.stroke();
      g.strokeStyle = 'rgba(50, 66, 90, 0.5)';
      g.beginPath();
      g.moveTo(x0, y0);
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        g.lineTo(x0 + t * 2 - 1, y0 + Math.sin(Math.PI * t) * c.len);
      }
      g.stroke();
    }
  }

  function drawSignPanels(g) {
    for (const s of signs) {
      const w = textWidth(s.text, s.scale) + 12;
      const h = 5 * s.scale + 12;
      g.fillStyle = 'rgba(3, 6, 12, 0.92)';
      g.fillRect(s.px - 6, s.py - 6, w, h);
      g.strokeStyle = 'rgba(120, 150, 190, 0.35)';
      g.lineWidth = 1;
      g.strokeRect(s.px - 6.5, s.py - 6.5, w, h);
      g.fillStyle = s.color;
      g.globalAlpha = 0.12;
      g.fillRect(s.px - 6, s.py - 6, w, h);
      g.globalAlpha = 1;
      drawText(g, s.text, s.px, s.py, s.scale, s.color, 'rgba(0, 0, 0, 0.9)');
      // bracket marks
      g.fillStyle = s.color;
      g.fillRect(s.px - 6, s.py - 6, 3, 1);
      g.fillRect(s.px - 6, s.py - 6, 1, 3);
      g.fillRect(s.px + w - 9, s.py + h - 7, 3, 1);
      g.fillRect(s.px + w - 7, s.py + h - 9, 1, 3);
    }
  }

  window.NF = window.NF || {};
  window.NF.level = level;
})();
