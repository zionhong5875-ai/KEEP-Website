import { parse } from 'parse5';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const attr = (n, key) => n.attrs?.find(a => a.name === key)?.value;
const nodes = n => [n, ...(n.childNodes || []).flatMap(nodes)];
const text = n => n ? nodes(n).filter(x => x.nodeName === '#text').map(x => x.value).join('').trim() : '';

// Read final, localized HTML rather than guessing which source strings render links.
export function extractBacklinks(html, path) {
  const all = nodes(parse(html));
  const terms = new Set();
  for (const node of all.filter(n => n.tagName === 'a')) {
    const match = (attr(node, 'href') || '').match(/^\/(?:en\/)?resources\/glossary\/([^/?#]+)\/?(?:[?#].*)?$/);
    if (!match) continue;
    let parent = node.parentNode, main = false, excluded = false;
    while (parent) {
      if (parent.tagName === 'main') main = true;
      if (['nav','header','footer','h1','h2','h3','h4','figcaption'].includes(parent.tagName) || /hero|knowledge-cloud|term-other/.test(attr(parent,'class') || '')) excluded = true;
      parent = parent.parentNode;
    }
    if (main && !excluded) terms.add(match[1]);
  }
  const meta = property => attr(all.find(n => n.tagName === 'meta' && attr(n, 'property') === property) || {}, 'content');
  const title = text(all.find(n => n.tagName === 'h1'));
  return { terms: [...terms].sort(), page: { href: path, title, description: meta('og:description') || '', image: new URL(meta('og:image') || '/assets/resource-library.jpg', 'https://local.invalid').pathname } };
}

export async function generateBacklinks(base, output) {
  if (output instanceof URL) output = fileURLToPath(output);
  const get = async path => {
    const r = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`Backlink generation failed: ${path} HTTP ${r.status}`);
    return r.text();
  };
  const sitemap = await get('/sitemap.xml');
  const paths = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname))]
    .filter(p => !/^\/(?:en\/)?resources\/glossary\//.test(p)).sort();
  if (!paths.length) throw new Error('Backlink generation found no source pages');
  const result = { zh: {}, en: {} };
  for (const path of paths) {
    const { terms, page } = extractBacklinks(await get(path), path);
    const lang = path.startsWith('/en/') ? 'en' : 'zh';
    for (const slug of terms) (result[lang][slug] ||= []).push(page);
  }
  const json = JSON.stringify(result, null, 2) + '\n';
  const old = await fs.readFile(output, 'utf8').catch(() => '');
  if (old !== json) {
    const temporary = `${output}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, json);
      await fs.rename(temporary, output);
    } finally { await fs.rm(temporary, { force: true }); }
  }
  return { pages: paths.length, relations: Object.values(result).reduce((sum, terms) => sum + Object.values(terms).reduce((n, pages) => n + pages.length, 0), 0) };
}
