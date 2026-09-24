import assert from "node:assert/strict";
import { parse } from "parse5";
import { glossaryAliasEntries, glossaryLinkTargets } from "../src/utils/glossary-links.mjs";
import { localizedSearchPaths } from "../src/utils/search-routes.mjs";

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4321";
const walk = (node) => [node, ...(node.childNodes || []).flatMap(walk)];
const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
const nodeText = (node) => node.nodeName === "#text" ? node.value : (node.childNodes || []).map(nodeText).join("");
const ancestors = (node) => {
  const result = [];
  let parent = node.parentNode;
  while (parent) { result.push(parent); parent = parent.parentNode; }
  return result;
};
const hasClass = (node, name) => attr(node, "class")?.split(/\s+/).includes(name);
const routes = localizedSearchPaths.filter((route) => !route.startsWith("/en/") && !route.startsWith("/resources/glossary/") && route !== "/resources/glossary/");
const aliases = new Map(glossaryAliasEntries.map((entry) => [
  `${entry.language}:${entry.slug}:${entry.normalized}`,
  entry
]));
let checkedPages = 0;
let linkCount = 0;

for (const language of ["zh", "en"]) {
  const prefix = language === "en" ? "/en" : "";
  for (const route of routes) {
    const pathname = `${prefix}${route}`;
    const response = await fetch(new URL(pathname, base));
    assert.equal(response.status, 200, pathname);
    const document = parse(await response.text());
    const nodes = walk(document);
    const links = nodes.filter((node) => node.tagName === "a" && attr(node, "data-glossary-link"));
    for (const link of links) {
      const slug = attr(link, "data-glossary-link");
      assert.ok(glossaryLinkTargets.has(slug), `${pathname}: unknown glossary target ${slug}`);
      assert.equal(attr(link, "href"), `${prefix}/resources/glossary/${slug}/`, `${pathname}: wrong target for ${slug}`);
      const normalizedText = language === "en" ? nodeText(link).toLocaleLowerCase("en-US") : nodeText(link);
      assert.ok([...aliases.values()].some((entry) => entry.slug === slug && entry.language === language && entry.normalized === normalizedText), `${pathname}: unregistered link text ${nodeText(link)}`);
      for (const parent of ancestors(link)) {
        assert.notEqual(parent.tagName, "a", `${pathname}: nested glossary link`);
        assert.notEqual(parent.tagName, "h1", `${pathname}: glossary link in H1`);
        assert.notEqual(parent.tagName, "h2", `${pathname}: glossary link in H2`);
        assert.notEqual(parent.tagName, "h3", `${pathname}: glossary link in H3`);
        assert.notEqual(parent.tagName, "h4", `${pathname}: glossary link in H4`);
        assert.notEqual(parent.tagName, "nav", `${pathname}: glossary link in navigation`);
        assert.notEqual(parent.tagName, "figcaption", `${pathname}: glossary link in caption`);
        assert.notEqual(parent.tagName, "script", `${pathname}: glossary link in script`);
        assert.notEqual(parent.tagName, "style", `${pathname}: glossary link in style`);
        assert.ok(!hasClass(parent, "hero"), `${pathname}: glossary link in hero`);
        assert.ok(!hasClass(parent, "term-page"), `${pathname}: glossary link in term page`);
        if (["section", "article"].includes(parent.tagName)) {
          const heading = (parent.childNodes || []).flatMap(walk).find((node) => ["h1", "h2", "h3", "h4"].includes(node.tagName));
          assert.ok(!heading || !/^(references?|references and data sources|参考文献|参考资料)/i.test(nodeText(heading).trim()), `${pathname}: glossary link in references`);
        }
      }
      linkCount += 1;
    }
    checkedPages += 1;
  }
}

assert.ok(linkCount > 0, "no glossary inline links were generated");
console.log(`PASS: checked ${checkedPages} localized non-glossary pages and ${linkCount} inline glossary links; targets, aliases, language paths, exclusions, and nesting are valid.`);
