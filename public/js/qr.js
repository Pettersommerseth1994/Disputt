import qrcode from './vendor/qrcode.js';

/**
 * Join-link QR code as an SVG string: ink modules on cream. Plain square modules on purpose —
 * styling the modules (rounding, blobs) measurably hurts decoding, and this is the way into the game.
 */
export function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2; // the cream card around it provides the rest of the quiet zone
  const size = n + quiet * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff6e3"/><path d="${d}" fill="#1c0a10"/></svg>`;
}
