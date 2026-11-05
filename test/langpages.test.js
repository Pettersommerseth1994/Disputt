// disputt.site/da/ and /sv/ (public/da/index.html, public/sv/index.html) are generated from public/index.html (tools/pages/langpages.mjs).
// They must be what the generator writes now, say their own language in the parts a link preview shows, and reach every file from one folder down.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { LANG_PAGES, LEGAL_PAGES, langPage, legalPage } from '../tools/pages/langpages.mjs';

const PUBLIC = join(fileURLToPath(new URL('..', import.meta.url)), 'public');
const index = readFileSync(join(PUBLIC, 'index.html'), 'utf8');

for (const lang of Object.keys(LANG_PAGES)) {
  const file = join(PUBLIC, lang, 'index.html');
  const page = readFileSync(file, 'utf8');

  test(`${lang}: the committed page is what the generator writes (run node tools/pages/langpages.mjs after changing public/index.html)`, () => {
    assert.equal(page, langPage(index, lang));
  });

  test(`${lang}: language, title pieces of the link preview, and the picture are its own`, () => {
    const p = LANG_PAGES[lang];
    assert.ok(page.includes(`<html lang="${p.html}" data-sprak="${lang}"`));
    assert.ok(page.includes(`<meta property="og:url" content="https://disputt.site/${lang}/">`));
    assert.ok(page.includes(`<link rel="canonical" href="https://disputt.site/${lang}/">`));
    assert.ok(page.includes(`content="https://disputt.site/${p.image}"`));
    assert.ok(page.includes(`<meta property="og:locale" content="${p.locale}">`));
    assert.ok(existsSync(join(PUBLIC, p.image)), 'the share picture exists');
    for (const word of ['uenighetsgaranti', 'quizspill', 'sosialt', 'Én av dere']) assert.ok(!page.includes(word), `still Norwegian: ${word}`);
  });

  test(`${lang}: every address of the page points at a file that exists (one folder down)`, () => {
    const found = [...page.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|#|data:|mailto:)/.test(u));
    assert.ok(found.length > 10);
    for (const u of found) {
      assert.ok(u.startsWith('../'), `not relative to the site root: ${u}`);
      const target = normalize(join(dirname(file), u.split('?')[0]));
      assert.ok(existsSync(target), `missing: ${u}`);
    }
  });
}

test('the Norwegian page links to both and names itself as the standard', () => {
  assert.ok(index.includes('<link rel="alternate" hreflang="da" href="https://disputt.site/da/">'));
  assert.ok(index.includes('<link rel="alternate" hreflang="sv" href="https://disputt.site/sv/">'));
  assert.ok(index.includes('<link rel="canonical" href="https://disputt.site/">'));
});

for (const lang of Object.keys(LANG_PAGES)) {
  for (const name of LEGAL_PAGES) {
    const source = readFileSync(join(PUBLIC, `${name}.html`), 'utf8');
    const file = join(PUBLIC, lang, `${name}.html`);
    const page = readFileSync(file, 'utf8');
    const p = LANG_PAGES[lang];

    test(`${lang}/${name}: the committed page is what the generator writes`, () => {
      assert.equal(page, legalPage(source, lang, name));
    });

    test(`${lang}/${name}: only its own language, in the head too, with the other versions linked`, () => {
      assert.equal([...page.matchAll(/data-lang="/g)].length, 1, 'one block');
      assert.ok(page.includes(`<div lang="${p.html}" data-lang="${lang}"`));
      assert.ok(page.includes(`<html lang="${p.html}">`));
      assert.ok(!page.includes('hidden'), 'nothing hidden');
      assert.ok(!page.includes('legal-lang.js'), 'no script that picks a block');
      assert.ok(page.includes(`<link rel="canonical" href="https://disputt.site/${lang}/${name}.html">`));
      for (const [h, u] of [['nb', `${name}.html`], ['da', `da/${name}.html`], ['sv', `sv/${name}.html`]]) assert.ok(page.includes(`<link rel="alternate" hreflang="${h}" href="https://disputt.site/${u}">`));
      const title = /<title>([^<]*)<\/title>/.exec(page)[1];
      const own = new RegExp(`data-lang="${lang}" data-title="${title}"`);
      assert.match(page, own, 'the title of the page is the title of its block');
      assert.ok(page.includes('kontakt@disputt.site'));
    });

    test(`${lang}/${name}: the files and the links of the page reach something that exists`, () => {
      const found = [...page.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|#|data:|mailto:)/.test(u));
      for (const u of found) {
        const target = normalize(join(dirname(file), u.split('?')[0]));
        assert.ok(existsSync(u.endsWith('/') ? join(target, 'index.html') : target), `missing: ${u}`);
      }
      assert.ok(found.some((u) => u.startsWith('../css/')), 'the style sheet is found one folder up');
    });
  }
}

test('the Norwegian terms and privacy pages link to the Danish and Swedish ones and are their own canonical', () => {
  for (const name of LEGAL_PAGES) {
    const source = readFileSync(join(PUBLIC, `${name}.html`), 'utf8');
    assert.ok(source.includes(`<link rel="canonical" href="https://disputt.site/${name}.html">`));
    assert.ok(source.includes(`hreflang="da" href="https://disputt.site/da/${name}.html"`));
    assert.ok(source.includes(`hreflang="sv" href="https://disputt.site/sv/${name}.html"`));
  }
});
