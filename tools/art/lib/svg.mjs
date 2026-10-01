// SVG document assembly: id-prefixed defs, the paper/grain filter, output.

export class Canvas {
  constructor(id, w = 400, h = 400) {
    this.id = id;
    this.w = w;
    this.h = h;
    this.defs = [];
    this.n = 0;
  }
  uid(tag = 'x') { return `${this.id}-${tag}${(this.n++).toString(36)}`; }
  clip(d, rule) {
    const id = this.uid('c');
    this.defs.push(`<clipPath id="${id}"><path d="${d}"${rule ? ` clip-rule="${rule}"` : ''}/></clipPath>`);
    return id;
  }
  def(s) { this.defs.push(s); }

  /**
   * Paper filter (one per file, three turbulences):
   *  1. low-frequency displacement → hand wobble
   *  2. fine displacement driven by the grain noise's R/G channels → ragged, waxy crayon edges
   *  3. patchy paper tooth: the grain noise's alpha mixed with a low-frequency "pressure" noise,
   *     thresholded into specks. Specks are tinted cream (paper/wax showing through), which
   *     reads the same on yellow tiles and on the burgundy app background. An optional
   *     `knock` range punches real holes instead/as well.
   */
  paperFilter({
    wobble = 4.5, wobbleFreq = 0.022, fuzz = 4.2,
    grainFreq = 0.75, patchFreq = 0.05, patchMix = 0.4,
    speckLo = 0.33, speckHi = 0.39, speckA = 0.75, speckColor = '#fff6e3',
    knock = null, seed = 7, region = null,
  } = {}) {
    const id = this.uid('f');
    const [x, y, w, h] = region || [0, 0, this.w, this.h];
    const table = (lo, hi, inv, amp) => {
      const N = 40, tv = [];
      for (let i = 0; i < N; i++) {
        const v = i / (N - 1);
        let a = v <= lo ? 0 : v >= hi ? 1 : (v - lo) / (hi - lo);
        if (inv) a = 1 - a;
        tv.push(+(a * amp).toFixed(2));
      }
      return tv.join(' ');
    };
    let f =
      `<filter id="${id}" filterUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${wobbleFreq}" numOctaves="1" seed="${seed}" result="a"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="a" scale="${wobble}" xChannelSelector="R" yChannelSelector="G" result="b"/>` +
      `<feTurbulence type="fractalNoise" baseFrequency="${grainFreq}" numOctaves="2" seed="${seed + 2}" result="e"/>` +
      `<feDisplacementMap in="b" in2="e" scale="${fuzz}" xChannelSelector="R" yChannelSelector="G" result="d"/>` +
      `<feTurbulence type="fractalNoise" baseFrequency="${patchFreq}" numOctaves="1" seed="${seed + 3}" result="e2"/>` +
      `<feComposite in="e" in2="e2" operator="arithmetic" k2="${1 - patchMix}" k3="${patchMix}" result="n"/>`;
    let src = 'd';
    if (knock) {
      f += `<feComponentTransfer in="n" result="k"><feFuncA type="table" tableValues="${table(knock[0], knock[1], false, 1)}"/></feComponentTransfer>` +
        `<feComposite in="d" in2="k" operator="in" result="dk"/>`;
      src = 'dk';
    }
    if (speckA > 0) {
      f += `<feComponentTransfer in="n" result="s"><feFuncA type="table" tableValues="${table(speckLo, speckHi, true, speckA)}"/></feComponentTransfer>` +
        `<feFlood flood-color="${speckColor}"/><feComposite in2="s" operator="in"/><feComposite in2="${src}" operator="in" result="g"/>` +
        `<feMerge><feMergeNode in="${src}"/><feMergeNode in="g"/></feMerge>`;
    } else if (src === 'd') {
      f += `<feMerge><feMergeNode in="d"/></feMerge>`;
    }
    f += `</filter>`;
    this.defs.push(f);
    return id;
  }

  render(body, { filter = null, extraDefs = '' } = {}) {
    const defs = this.defs.join('') + extraDefs;
    const inner = filter ? `<g filter="url(#${filter})">${body}</g>` : body;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}">` +
      (defs ? `<defs>${defs}</defs>` : '') +
      inner +
      `</svg>\n`
    );
  }
}

export const tf = (x, y, r = 0, s = 1) => {
  let t = `translate(${+x.toFixed(1)} ${+y.toFixed(1)})`;
  if (r) t += ` rotate(${+r.toFixed(1)})`;
  if (s !== 1) t += ` scale(${+s.toFixed(3)})`;
  return t;
};
