// The QR code must actually scan. We rasterize the exact SVG the app renders and decode it with an independent reader.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jsQR from 'jsqr';
import sharp from 'sharp';
import { qrSvg } from '../public/js/qr.js';

async function decode(svg, px) {
  const { data, info } = await sharp(Buffer.from(svg), { density: 300 })
    .resize(px, px)
    .flatten({ background: '#ffffff' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

describe('join QR code', () => {
  const urls = [
    'https://disputt.no/j/KRAP',
    'http://192.168.100.59:3000/j/QWXZ',
    'https://disputt-abc123.onrender.com/j/MNBV',
    'https://some-quick-tunnel-name-here.trycloudflare.com/j/ABCD',
  ];
  for (const url of urls) {
    for (const px of [160, 220, 360, 720, 1100]) {
      it(`decodes ${url} at ${px}px`, async () => {
        assert.equal(await decode(qrSvg(url), px), url);
      });
    }
  }
});
