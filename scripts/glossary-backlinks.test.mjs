import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractBacklinks } from './glossary-backlinks.mjs';
const link = '<a href="/resources/glossary/gmp/">GMP</a>';
test('only actual body links count; plain words and hero/nav mentions do not', () => {
  assert.deepEqual(extractBacklinks(`<main><h1>${link}</h1><nav>${link}</nav><section class="hero"><p>${link}</p></section><p>GMP</p></main>`, '/').terms, []);
});
test('adding and removing links changes relations, duplicates collapse', () => {
  assert.deepEqual(extractBacklinks(`<main><p>${link}${link}</p></main>`, '/').terms, ['gmp']);
  assert.deepEqual(extractBacklinks('<main><p>GMP</p></main>', '/').terms, []);
});
test('localized links and source page metadata are preserved', () => {
  const r=extractBacklinks('<meta property="og:description" content="Description"><main><h1>English page</h1><p><a href="/en/resources/glossary/gmp/">GMP</a></p></main>', '/en/about/vinner/');
  assert.deepEqual(r.terms,['gmp']);assert.equal(r.page.href,'/en/about/vinner/');assert.equal(r.page.title,'English page');
});
