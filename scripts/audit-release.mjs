import fs from 'node:fs';
import { parse } from 'parse5';
import { localizedSearchPaths } from '../src/utils/search-routes.mjs';
import { searchConfig } from '../src/utils/search-config.mjs';

const base = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:4321';
const output = process.env.AUDIT_REPORT || '/tmp/vinner-release-audit.json';
const attr = (node, key) => node.attrs?.find(a => a.name === key)?.value;
const walk = (node, fn) => { fn(node); node.childNodes?.forEach(child => walk(child, fn)); };
const documents = new Map();
const links = new Map();
const issues = [];
for (const path of localizedSearchPaths) {
  const response = await fetch(new URL(path, base));
  const doc = parse(await response.text());
  documents.set(path, doc);
  const ids = new Set();
  walk(doc, node => {
    if (node.tagName === 'script' && attr(node, 'type') === 'application/ld+json') {
      const inspect = (value, key = '') => {
        if (Array.isArray(value)) value.forEach(v => inspect(v, key));
        else if (value && typeof value === 'object') Object.entries(value).forEach(([k,v]) => inspect(v,k));
        else if (typeof value === 'string' && ['url','contentUrl','image'].includes(key) && value.startsWith(searchConfig.siteUrl + '/')) {
          const url = new URL(value);
          const destination = url.pathname + url.search + url.hash;
          if (!links.has(destination)) links.set(destination, []);
          links.get(destination).push(path);
        }
      };
      try { inspect(JSON.parse(node.childNodes.map(n=>n.value || '').join(''))); }
      catch { issues.push({path,issue:'invalid JSON-LD'}); }
    }
    const id = attr(node, 'id');
    if (id && ids.has(id)) issues.push({ path, issue: 'duplicate id', value: id });
    if (id) ids.add(id);
    if (node.nodeName === '#text' && !['script', 'style'].includes(node.parentNode?.tagName)) {
      if (/\[保留|\[object Object\]|Lorem ipsum|TODO|TBD|示例术语|详情待补充/i.test(node.value)) issues.push({ path, issue: 'editorial placeholder', value: node.value.slice(0, 180) });
    }
    for (const key of node.tagName === 'a' ? ['href'] : ['img', 'script', 'source'].includes(node.tagName) ? ['src'] : []) {
      const value = attr(node, key);
      if (!value || !/^(\/|#)/.test(value) || value.startsWith('//')) continue;
      const url = new URL(value, new URL(path, base));
      const destination = url.pathname + url.search + url.hash;
      if (!links.has(destination)) links.set(destination, []);
      links.get(destination).push(path);
    }
  });
}
for (const [destination, sources] of links) {
  const url = new URL(destination, base);
  if (url.pathname.startsWith('/api/')) continue;
  const target = documents.get(url.pathname);
  if (!target) {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) issues.push({ path: [...new Set(sources)], issue: `link/asset HTTP ${response.status}`, value: destination });
  }
  if (target && url.hash) {
    let found = false;
    walk(target, node => { if (attr(node, 'id') === decodeURIComponent(url.hash.slice(1))) found = true; });
    if (!found) issues.push({ path: [...new Set(sources)], issue: 'missing anchor', value: destination });
  }
}
const result = { date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()), pages: documents.size, destinations: links.size, issues };
fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (issues.length) process.exitCode = 1;
