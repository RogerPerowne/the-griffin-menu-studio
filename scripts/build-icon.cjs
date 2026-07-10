// Generates build/icon.png + build/icon.ico: the Griffin crest (recoloured)
// on a solid circular background. Run with `node scripts/build-icon.cjs`.
// Icon-only colours, per the owner: circle #00403d, crest #FFF4F4 — these are
// NOT part of the app's ivory/bronze UI palette, scoped to the app icon only.
//
// All sizes are bilinear-downscaled from one crisp 1024x1024 master render —
// simplest and, on inspection, better-looking than per-size dilation.
'use strict';

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;

const CIRCLE_COLOR = { r: 0x00, g: 0x40, b: 0x3d }; // #00403d
const CREST_COLOR = { r: 0xff, g: 0xf4, b: 0xf4 }; // #FFF4F4
const CANVAS = 1024;
const RADIUS = 486; // ~26px margin at 1024, feathered edge below
const FEATHER = 1.5;
const CREST_FIT = 0.68; // crest occupies this fraction of the circle's diameter

const ROOT = path.join(__dirname, '..');
const CREST_SRC = path.join(ROOT, 'assets', 'brands', 'griffin', 'crest.png');
const OUT_PNG = path.join(ROOT, 'build', 'icon.png');
const OUT_ICO = path.join(ROOT, 'build', 'icon.ico');

function newCanvas(size) {
  return { width: size, height: size, data: Buffer.alloc(size * size * 4) };
}

function setPx(img, x, y, r, g, b, a) {
  const i = (img.width * y + x) * 4;
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = a;
}

function getPx(img, x, y) {
  x = Math.max(0, Math.min(img.width - 1, x));
  y = Math.max(0, Math.min(img.height - 1, y));
  const i = (img.width * y + x) * 4;
  return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2], a: img.data[i + 3] };
}

/** Alpha "over" composite: paints (r,g,b,a) over dst at (x,y). */
function compositeOver(dst, x, y, srcR, srcG, srcB, srcA255) {
  const srcA = srcA255 / 255;
  if (srcA <= 0) return;
  const under = getPx(dst, x, y);
  const dstA = under.a / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) {
    setPx(dst, x, y, 0, 0, 0, 0);
    return;
  }
  const r = (srcR * srcA + under.r * dstA * (1 - srcA)) / outA;
  const g = (srcG * srcA + under.g * dstA * (1 - srcA)) / outA;
  const b = (srcB * srcA + under.b * dstA * (1 - srcA)) / outA;
  setPx(dst, x, y, Math.round(r), Math.round(g), Math.round(b), Math.round(outA * 255));
}

function drawCircle(img, cx, cy, radius, feather, color) {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let a = 0;
      if (dist <= radius - feather) a = 255;
      else if (dist <= radius + feather) a = Math.round((1 - (dist - (radius - feather)) / (feather * 2)) * 255);
      if (a > 0) setPx(img, x, y, color.r, color.g, color.b, a);
    }
  }
}

/** Bilinear resize of an RGBA buffer. */
function resize(src, srcW, srcH, dstW, dstH) {
  const dst = { width: dstW, height: dstH, data: Buffer.alloc(dstW * dstH * 4) };
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const sy = (y + 0.5) * yRatio - 0.5;
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    for (let x = 0; x < dstW; x++) {
      const sx = (x + 0.5) * xRatio - 0.5;
      const x0 = Math.floor(sx);
      const fx = sx - x0;
      const p00 = getPx(src, x0, y0);
      const p10 = getPx(src, x0 + 1, y0);
      const p01 = getPx(src, x0, y0 + 1);
      const p11 = getPx(src, x0 + 1, y0 + 1);
      const lerp = (a, b, t) => a + (b - a) * t;
      const mix = (k) => lerp(lerp(p00[k], p10[k], fx), lerp(p01[k], p11[k], fx), fy);
      const i = (dstW * y + x) * 4;
      dst.data[i] = Math.round(mix('r'));
      dst.data[i + 1] = Math.round(mix('g'));
      dst.data[i + 2] = Math.round(mix('b'));
      dst.data[i + 3] = Math.round(mix('a'));
    }
  }
  return dst;
}

function toPngBuffer(img) {
  const png = new PNG({ width: img.width, height: img.height });
  img.data.copy(png.data);
  return PNG.sync.write(png);
}

async function main() {
  const crestPng = PNG.sync.read(fs.readFileSync(CREST_SRC));
  const crestSrc = { width: crestPng.width, height: crestPng.height, data: crestPng.data };

  const targetBox = RADIUS * 2 * CREST_FIT;
  const scale = Math.min(targetBox / crestSrc.width, targetBox / crestSrc.height);
  const crestW = Math.round(crestSrc.width * scale);
  const crestH = Math.round(crestSrc.height * scale);
  const crestResized = resize(crestSrc, crestSrc.width, crestSrc.height, crestW, crestH);

  const canvas = newCanvas(CANVAS);
  const cx = CANVAS / 2;
  const cy = CANVAS / 2;
  drawCircle(canvas, cx, cy, RADIUS, FEATHER, CIRCLE_COLOR);

  const offsetX = Math.round(cx - crestW / 2);
  const offsetY = Math.round(cy - crestH / 2);
  for (let y = 0; y < crestH; y++) {
    for (let x = 0; x < crestW; x++) {
      const p = getPx(crestResized, x, y);
      if (p.a === 0) continue;
      compositeOver(canvas, offsetX + x, offsetY + y, CREST_COLOR.r, CREST_COLOR.g, CREST_COLOR.b, p.a);
    }
  }

  fs.mkdirSync(path.dirname(OUT_PNG), { recursive: true });
  fs.writeFileSync(OUT_PNG, toPngBuffer(canvas));
  console.log('wrote', OUT_PNG, `${CANVAS}x${CANVAS}`);

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoBuffers = icoSizes.map((size) => toPngBuffer(resize(canvas, CANVAS, CANVAS, size, size)));
  const icoBuffer = await pngToIco(icoBuffers);
  fs.writeFileSync(OUT_ICO, icoBuffer);
  console.log('wrote', OUT_ICO, `sizes: ${icoSizes.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
