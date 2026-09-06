/* eslint-env node */
/**
 * Zirtan uygulama ikonlarını üretir (pngjs ile, harici araç gerektirmez).
 *   node scripts/generate-icons.js
 * Üretilenler: assets/images/{icon,splash-icon,favicon,android-icon-*}.png
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const OUT = path.join(__dirname, '..', 'assets', 'images');
const SS = 4; // süperörnekleme (kenar yumuşatma)

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

const C = {
  bgTop: hex('#13221B'),
  bgBottom: hex('#0B1210'),
  mint: hex('#5EE39B'),
  mintDark: hex('#2FCF7A'),
  deep: hex('#1B4332'),
  amber: hex('#FFB547'),
  snow: hex('#F2F7F4'),
  white: hex('#FFFFFF'),
};

/** Şekil seti: birim karede (0..1) tanımlı; `scale` ve `offset` ile yerleştirilir. */
function shapes({ mono = false } = {}) {
  const mint = mono ? C.white : C.mint;
  const mintDark = mono ? C.white : C.mintDark;
  const deep = mono ? C.white : C.deep;
  const amber = mono ? C.white : C.amber;
  const snow = mono ? C.white : C.snow;
  return [
    { type: 'circle', cx: 0.7, cy: 0.34, r: 0.085, color: amber },
    {
      type: 'poly',
      pts: [
        [0.28, 0.74],
        [0.58, 0.32],
        [0.88, 0.74],
      ],
      color: deep,
    },
    {
      type: 'poly',
      pts: [
        [0.1, 0.74],
        [0.4, 0.36],
        [0.7, 0.74],
      ],
      color: mintDark,
    },
    {
      type: 'poly',
      pts: [
        [0.1, 0.74],
        [0.4, 0.36],
        [0.52, 0.52],
        [0.36, 0.74],
      ],
      color: mint,
    },
    {
      type: 'poly',
      pts: [
        [0.4, 0.36],
        [0.335, 0.445],
        [0.365, 0.435],
        [0.395, 0.465],
        [0.43, 0.44],
        [0.465, 0.445],
      ],
      color: snow,
    },
    { type: 'rect', x: 0.1, y: 0.74, w: 0.78, h: 0.045, color: deep },
  ];
}

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function render({ size, background, roundRadius = 0, content, scale = 1, offset = 0 }) {
  const big = size * SS;
  const buf = new Float32Array(big * big * 4);
  const list = content;

  for (let py = 0; py < big; py++) {
    const v = (py + 0.5) / big;
    for (let px = 0; px < big; px++) {
      const u = (px + 0.5) / big;
      const idx = (py * big + px) * 4;

      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      if (background) {
        const insideRound =
          roundRadius === 0 ||
          (() => {
            const rr = roundRadius;
            const dx = Math.max(rr - u, 0, u - (1 - rr));
            const dy = Math.max(rr - v, 0, v - (1 - rr));
            return dx * dx + dy * dy <= rr * rr;
          })();
        if (insideRound) {
          const t = v;
          r = C.bgTop[0] * (1 - t) + C.bgBottom[0] * t;
          g = C.bgTop[1] * (1 - t) + C.bgBottom[1] * t;
          b = C.bgTop[2] * (1 - t) + C.bgBottom[2] * t;
          a = 255;
        }
      }

      const x = (u - offset) / scale;
      const y = (v - offset) / scale;
      for (const s of list) {
        let hit = false;
        if (s.type === 'circle') hit = (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r ** 2;
        else if (s.type === 'rect') hit = x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
        else hit = inPoly(x, y, s.pts);
        if (hit) {
          [r, g, b] = s.color;
          a = 255;
        }
      }
      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = a;
    }
  }

  // Alt örnekleme (premultiplied ortalama)
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * big + (x * SS + sx)) * 4;
          const al = buf[i + 3] / 255;
          r += buf[i] * al;
          g += buf[i + 1] * al;
          b += buf[i + 2] * al;
          a += al;
        }
      }
      const o = (y * size + x) * 4;
      if (a > 0) {
        png.data[o] = Math.round(r / a);
        png.data[o + 1] = Math.round(g / a);
        png.data[o + 2] = Math.round(b / a);
        png.data[o + 3] = Math.round((a / (SS * SS)) * 255);
      } else {
        png.data[o] = png.data[o + 1] = png.data[o + 2] = png.data[o + 3] = 0;
      }
    }
  }
  return PNG.sync.write(png);
}

function write(name, data) {
  fs.writeFileSync(path.join(OUT, name), data);
  console.log('✓', name);
}

fs.mkdirSync(OUT, { recursive: true });
write('icon.png', render({ size: 1024, background: true, content: shapes() }));
write(
  'splash-icon.png',
  render({ size: 512, background: false, content: shapes(), scale: 1.1, offset: -0.05 }),
);
write('favicon.png', render({ size: 64, background: true, roundRadius: 0.22, content: shapes() }));
// Android adaptive: içerik güvenli bölgeye (orta %66) sığmalı
write(
  'android-icon-foreground.png',
  render({ size: 1024, background: false, content: shapes(), scale: 0.66, offset: 0.17 }),
);
write('android-icon-background.png', render({ size: 1024, background: true, content: [] }));
write(
  'android-icon-monochrome.png',
  render({
    size: 1024,
    background: false,
    content: shapes({ mono: true }),
    scale: 0.66,
    offset: 0.17,
  }),
);
