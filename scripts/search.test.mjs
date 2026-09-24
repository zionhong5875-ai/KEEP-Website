import test from "node:test";
import assert from "node:assert/strict";
import { getSearchConfig, canIndexRequest, robotsText, INDEXNOW_KEY } from "../src/utils/search-config.mjs";
import { buildSitemap, canonicalPath, localizedSearchPaths } from "../src/utils/search-routes.mjs";
import { createSubmission, submitIndexNow, endpoint } from "./indexnow.mjs";

const production = { PUBLIC_SITE_URL: "https://www.example.com", VERCEL_ENV: "production" };

test("only the configured production host is indexable; preview always stays blocked", () => {
  assert.equal(getSearchConfig({}).indexingEnabled, false);
  const config = getSearchConfig(production);
  assert.equal(canIndexRequest(new URL("https://www.example.com/en/"), config), true);
  assert.equal(canIndexRequest(new URL("https://preview.example.com/"), config), false);
  assert.equal(getSearchConfig({ ...production, SITE_INDEXING_ENABLED: "false" }).indexingEnabled, false);
  assert.equal(getSearchConfig({ ...production, VERCEL_ENV: "preview", SITE_INDEXING_ENABLED: "true" }).indexingEnabled, false);
  assert.throws(() => getSearchConfig({ VERCEL_ENV: "production" }), /explicitly/);
  for (const url of ["http://example.com", "https://example.com/path", "https://example.com/?q=x", "https://localhost", "https://127.0.0.1"]) {
    assert.throws(() => getSearchConfig({ PUBLIC_SITE_URL: url }));
  }
});

test("robots allows public content/assets but excludes operational endpoints", () => {
  const robots = robotsText(getSearchConfig(production), true);
  assert.match(robots, /Sitemap: https:\/\/www.example.com\/sitemap.xml/);
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/api\//);
  assert.doesNotMatch(robots, /Disallow: \/(?:assets|_astro)/);
  assert.equal(robotsText(getSearchConfig({}), false), "User-agent: *\nDisallow: /\n");
});

test("sitemap emits only clean localized URLs with reciprocal language alternatives", () => {
  const xml = buildSitemap(production.PUBLIC_SITE_URL);
  assert.equal((xml.match(/<loc>/g) || []).length, localizedSearchPaths.length);
  assert.ok(localizedSearchPaths.includes("/resources/glossary/"));
  assert.ok(localizedSearchPaths.includes("/resources/eu-forced-labour-regulation-preparation/"));
  assert.equal((xml.match(/hreflang=/g) || []).length, localizedSearchPaths.length * 3);
  assert.doesNotMatch(xml, /\/about\/factory\/|\/api\/|\/admin\/|coming-soon/);
  assert.doesNotMatch(xml, /<priority>|<changefreq>/);
  assert.equal(canonicalPath("/en/products"), "/en/products/");
  assert.equal(canonicalPath("/not-a-page"), null);
});

test("IndexNow rejects noncanonical, unpublished and foreign URLs before network access", () => {
  const all = createSubmission({ all: true }, production);
  assert.equal(all.payload.urlList.length, localizedSearchPaths.length);
  assert.equal(all.payload.keyLocation, `${production.PUBLIC_SITE_URL}/${INDEXNOW_KEY}.txt`);
  assert.throws(() => createSubmission({ submit: true, all: true }, {}), /requires/);
  assert.throws(() => createSubmission({ submit: true }, production), /Select/);
  for (const url of ["https://evil.example/", "/products/?utm_source=x", "/products", "/admin/", "/unknown/"]) {
    assert.throws(() => createSubmission({ url: [url] }, production));
  }
});

const fakeFetcher = (page, status = 200, key = INDEXNOW_KEY) => {
  const posts = [];
  return {
    posts,
    fetch: async (url, options = {}) => {
      if (url === endpoint) { posts.push(JSON.parse(options.body)); return new Response("", { status }); }
      if (url.endsWith(`${INDEXNOW_KEY}.txt`)) return new Response(key);
      if (url.endsWith("robots.txt")) return new Response("User-agent: *\nAllow: /\n");
      return page(url);
    }
  };
};

test("IndexNow submits only after key and live canonical checks, and preserves 202 semantics", async () => {
  const submission = createSubmission({ url: ["/en/contact/"], submit: true }, production);
  const mock = fakeFetcher(url => new Response(`<head><link rel="canonical" href="${url}"><meta name="robots" content="index, follow"></head>`), 202);
  const result = await submitIndexNow(submission, mock.fetch);
  assert.equal(mock.posts.length, 1);
  assert.deepEqual(mock.posts[0].urlList, ["https://www.example.com/en/contact/"]);
  assert.match(result[0].state, /validation pending/);
});

test("IndexNow never posts when the deployed key, canonical or indexing policy is wrong", async () => {
  const submission = createSubmission({ url: ["/contact/"] }, production);
  for (const mock of [
    fakeFetcher(() => new Response(""), 200, "wrong-key"),
    fakeFetcher(() => new Response('<head><link rel="canonical" href="https://other.example/"></head>')),
    fakeFetcher(url => new Response(`<head><link rel="canonical" href="${url}"><meta name="robots" content="noindex"></head>`)),
    fakeFetcher(() => new Response("not found", { status: 404 }))
  ]) {
    await assert.rejects(submitIndexNow(submission, mock.fetch));
    assert.equal(mock.posts.length, 0);
  }
});

test("IndexNow accepts removed URLs only when deletion is live", async () => {
  const submission = createSubmission({ removed: ["/resources/old-article/"] }, production);
  const deleted = fakeFetcher(() => new Response("Gone", { status: 410 }));
  await submitIndexNow(submission, deleted.fetch);
  assert.equal(deleted.posts.length, 1);
  const stillLive = fakeFetcher(() => new Response("Still live"));
  await assert.rejects(submitIndexNow(submission, stillLive.fetch));
  assert.equal(stillLive.posts.length, 0);
});
