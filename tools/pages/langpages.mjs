// The Danish and Swedish front doors of the game: public/da/index.html and public/sv/index.html. They are the same game as public/index.html (the same
// files, the same code) with the page's own language: <html lang data-sprak>, a title, description and share picture in that language, and the
// links to the other versions. js/i18n/lang.js reads data-sprak, so the game opens in that language and the language card does not ask.
// The point is the link preview: a chat or a feed shows what is in the HTML of the page, and a robot cannot ask which language the sender has.
//
// The terms and the privacy statement get the same treatment: public/da/vilkar.html, public/da/personvern.html and the same two in sv/. Their source
// (public/vilkar.html, public/personvern.html) holds one block per language and js/legal-lang.js picks the block that fits the phone; the page of a
// language here holds only its own block, with its own title, description, address and links to the other versions, so a link to it, a search result
// and a robot all get that language without asking anybody.
//
// The files are GENERATED from public/index.html, vilkar.html and personvern.html and are committed, so the dev server and the Pages build serve
// them like any other page.
// Usage: node tools/pages/langpages.mjs      (writes them; test/langpages.test.js fails when they are not what this would write)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = 'https://disputt.site/';

export const LANG_PAGES = {
  da: {
    html: 'da',
    locale: 'da_DK',
    description: 'Disputt, et quizspil med uenighedsgaranti. Et socialt bluff- og diskussionsspil for 2 eller flere.',
    ogTitle: 'Disputt: diskutér, manipulér og vind',
    ogDescription: 'Et quizspil med uenighedsgaranti. Et socialt bluff- og diskussionsspil for 2 eller flere. Én af jer er imposter.',
    imageAlt: 'Disputt: diskutér, manipulér og vind. Et quizspil med uenighedsgaranti.',
    image: 'assets/share/disputt-delingsbilde-da.jpg',
    noscript: 'Disputt kræver JavaScript for at fungere.',
  },
  sv: {
    html: 'sv',
    locale: 'sv_SE',
    description: 'Disputt, ett frågespel med osämjegaranti. Ett socialt bluff- och diskussionsspel för två eller fler.',
    ogTitle: 'Disputt: diskutera, manipulera och vinn',
    ogDescription: 'Ett frågespel med osämjegaranti. Ett socialt bluff- och diskussionsspel för två eller fler. En av er är impostor.',
    imageAlt: 'Disputt: diskutera, manipulera och vinn. Ett frågespel med osämjegaranti.',
    image: 'assets/share/disputt-delingsbilde-sv.jpg',
    noscript: 'Disputt kräver JavaScript för att fungera.',
  },
};

/** Replaces `from` with `to` exactly once, and stops when public/index.html does not have it any more (so the two cannot drift apart unseen). */
function swap(html, from, to) {
  if (!html.includes(from)) throw new Error(`public/index.html no longer has: ${from}`);
  return html.replace(from, () => to);
}

/** public/index.html as the page of one language. */
export function langPage(indexHtml, lang) {
  const p = LANG_PAGES[lang];
  let html = indexHtml;
  html = swap(html, '<html lang="nb" translate="no">', `<html lang="${p.html}" data-sprak="${lang}" translate="no">`);
  html = swap(html, '<meta name="description" content="Disputt, et quizspill med uenighetsgaranti. Et sosialt bløff- og diskusjonsspill for 2 eller flere.">', `<meta name="description" content="${p.description}">`);
  html = swap(html, '<meta property="og:title" content="Disputt: diskuter, manipuler og vinn">', `<meta property="og:title" content="${p.ogTitle}">`);
  html = swap(html, '<meta property="og:description" content="Et quizspill med uenighetsgaranti. Et sosialt bløff- og diskusjonsspill for 2 eller flere. Én av dere er imposter.">', `<meta property="og:description" content="${p.ogDescription}">`);
  html = swap(html, '<meta property="og:url" content="https://disputt.site/">', `<meta property="og:url" content="${SITE}${lang}/">`);
  html = swap(html, '<meta property="og:locale" content="nb_NO">', `<meta property="og:locale" content="${p.locale}">`);
  html = swap(html, '<meta property="og:image" content="https://disputt.site/assets/share/disputt-delingsbilde.jpg">', `<meta property="og:image" content="${SITE}${p.image}">`);
  html = swap(html, '<meta property="og:image:alt" content="Disputt: diskuter, manipuler og vinn. Et quizspill med uenighetsgaranti.">', `<meta property="og:image:alt" content="${p.imageAlt}">`);
  html = swap(html, '<meta name="twitter:image" content="https://disputt.site/assets/share/disputt-delingsbilde.jpg">', `<meta name="twitter:image" content="${SITE}${p.image}">`);
  html = swap(html, '<link rel="canonical" href="https://disputt.site/">', `<link rel="canonical" href="${SITE}${lang}/">`);
  html = swap(html, '<p style="padding:2rem;text-align:center">Disputt trenger JavaScript for å fungere.</p>', `<p style="padding:2rem;text-align:center">${p.noscript}</p>`);
  // the page is one folder down: every address that is relative to the site root gets `../` in front
  html = html.replace(/\b(href|src)="(?!https?:|\/|#|data:|mailto:)([^"]+)"/g, '$1="../$2"');
  return html;
}

export const LEGAL_PAGES = ['vilkar', 'personvern'];

/** One language of the terms or the privacy statement: the block of that language alone (not hidden), the page's own head, files from one folder down. */
export function legalPage(source, lang, name) {
  const marker = '\n  <div lang="';
  const first = source.indexOf(marker);
  const end = source.indexOf('\n</main>');
  if (first < 0 || end < 0) throw new Error(`public/${name}.html no longer has its blocks per language`);
  const blocks = source.slice(first, end).split(marker).slice(1).map((b) => marker + b);
  const block = blocks.find((b) => b.startsWith(`${marker}${LANG_PAGES[lang].html}" data-lang="${lang}"`));
  if (!block) throw new Error(`public/${name}.html has no block for ${lang}`);
  const attr = (a) => /data-title="([^"]*)"/.exec(block) && new RegExp(`data-${a}="([^"]*)"`).exec(block)[1];
  const title = attr('title');
  const description = attr('description');
  let html = source.slice(0, first) + block.replace(/\s*\n$/, '') + source.slice(end);
  html = swap(html, '<html lang="nb">', `<html lang="${LANG_PAGES[lang].html}">`);
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${description}">`);
  html = swap(html, `<link rel="canonical" href="${SITE}${name}.html">`, `<link rel="canonical" href="${SITE}${lang}/${name}.html">`);
  html = html.replace(' hidden>', '>');
  html = html.replace(' loading="lazy"', ''); // (the logo is the first thing on this page; in the page with all three it was only the first block's that was)
  html = html.replace(/\n<script src="js\/legal-lang\.js"><\/script>/, '');
  // the files (style, fonts, logo) are in the folder above; the links to the other terms page and to the game stay: they are in this folder
  html = html.replace(/\b(href|src)="(assets\/|css\/|js\/|favicon\.)/g, '$1="../$2');
  return html;
}

export function writeLangPages() {
  const read = (f) => fs.readFileSync(path.join(ROOT, 'public', f), 'utf8');
  const index = read('index.html');
  for (const lang of Object.keys(LANG_PAGES)) {
    const dir = path.join(ROOT, 'public', lang);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), langPage(index, lang));
    for (const name of LEGAL_PAGES) fs.writeFileSync(path.join(dir, `${name}.html`), legalPage(read(`${name}.html`), lang, name));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeLangPages();
  console.log('wrote public/{da,sv}/{index,vilkar,personvern}.html');
}
