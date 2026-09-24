import assert from "node:assert/strict";
import { parse } from "parse5";
import { localizedSearchPaths } from "../src/utils/search-routes.mjs";
import { searchConfig, INDEXNOW_KEY } from "../src/utils/search-config.mjs";

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4321";
const indexable = process.env.AUDIT_EXPECT_INDEXING === "true";
const origin = searchConfig.siteUrl;
const get = (path, options = {}) => fetch(new URL(path, base), { redirect: "manual", ...options });
const nodes = (root, predicate) => {
  const found = [];
  const visit = node => { if (predicate(node)) found.push(node); node.childNodes?.forEach(visit); };
  visit(root);
  return found;
};
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
const errors = [];
async function check(name, run) {
  try { await run(); } catch (error) { errors.push(`${name}: ${error.message}`); }
}

for (const path of localizedSearchPaths) {
  await check(path, async () => {
    const response = await get(`${path}?utm_source=audit&ref=duplicate`);
    assert.equal(response.status, 200);
    const html = parse(await response.text());
    const canonical = nodes(html, node => node.tagName === "link" && attr(node, "rel") === "canonical");
    assert.equal(canonical.length, 1);
    assert.equal(attr(canonical[0], "href"), `${origin}${path}`);
    const robots = nodes(html, node => node.tagName === "meta" && attr(node, "name") === "robots");
    assert.equal(robots.length, 1);
    assert.equal(/noindex/.test(attr(robots[0], "content")), !indexable);
    assert.equal(/noindex/.test(response.headers.get("x-robots-tag") || ""), !indexable);
    if (path !== "/") {
      const redirect = await get(`${path.slice(0, -1)}?utm_source=audit`);
      assert.equal(redirect.status, 301);
      assert.equal(redirect.headers.get("location"), `${path}?utm_source=audit`);
    }
  });
}

await check("robots.txt", async () => {
  const response = await get("/robots.txt");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/plain/);
  const text = await response.text();
  if (indexable) {
    assert.match(text, /Disallow: \/admin/);
    assert.ok(text.includes(`Sitemap: ${origin}/sitemap.xml`));
    assert.doesNotMatch(text, /^Disallow: \/$/m);
  } else assert.match(text, /^Disallow: \/$/m);
});

await check("sitemap.xml", async () => {
  const response = await get("/sitemap.xml");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/xml/);
  const xml = await response.text();
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(locations.sort(), localizedSearchPaths.map(path => `${origin}${path}`).sort());
  assert.equal(new Set(locations).size, locations.length);
});

await check("IndexNow verification file", async () => {
  const response = await get(`/${INDEXNOW_KEY}.txt`);
  assert.equal(response.status, 200);
  assert.equal((await response.text()).trim(), INDEXNOW_KEY);
});

await check("request headers cannot override the canonical or language", async () => {
  const response = await get("/contact/", { headers: { "x-vinner-language": "en", "x-vinner-public-path": "/en/forged/" } });
  const html = parse(await response.text());
  const canonical = nodes(html, node => node.tagName === "link" && attr(node, "rel") === "canonical")[0];
  assert.equal(attr(canonical, "href"), `${origin}/contact/`);
  assert.equal(attr(nodes(html, node => node.tagName === "html")[0], "lang"), "zh-CN");
});

for (const path of ["/nonexistent-audit-page/", "/en/nonexistent-audit-page/"]) {
  await check(path, async () => {
    const response = await get(path);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
  });
}

console.log(`Crawl audit: ${localizedSearchPaths.length} parameterized pages, ${localizedSearchPaths.length - 1} slash redirects, robots, sitemap, key, spoofed headers and 404s.`);
console.log(`Expected indexing: ${indexable}; failures: ${errors.length}`);
errors.forEach(error => console.error(error));
if (errors.length) process.exitCode = 1;
