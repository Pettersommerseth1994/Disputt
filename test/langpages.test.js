// disputt.site/da/ and /sv/ (public/da/index.html, public/sv/index.html) are generated from public/index.html (tools/pages/langpages.mjs).
// They must be what the generator writes now, say their own language in the parts a link preview shows, and reach every file from one folder down.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { LANG_PAGES, langPage } from '../tools/pages/langpages.mjs';

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
