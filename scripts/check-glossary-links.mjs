import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import glossary from "../src/data/site/glossary.json" with { type: "json" };
import linkTable from "../src/data/site/glossary-links.json" with { type: "json" };
import { glossaryAliasEntries } from "../src/utils/glossary-links.mjs";
import { localizedSearchPaths } from "../src/utils/search-routes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedSlugs = new Set(glossary.map((term) => term.slug));
const errors = [];
const allowedContexts = new Set(linkTable.defaultContexts);
const excludedContexts = new Set(linkTable.excludedContexts);

if (linkTable.version !== 1) errors.push(`unsupported table version: ${linkTable.version}`);
if (linkTable.terms.length !== glossary.length) errors.push(`table has ${linkTable.terms.length} terms, glossary has ${glossary.length}`);
if (new Set(linkTable.terms.map((term) => term.slug)).size !== linkTable.terms.length) errors.push("duplicate term rows");
for (const term of linkTable.terms) {
  if (!expectedSlugs.has(term.slug)) errors.push(`unknown glossary slug: ${term.slug}`);
  for (const context of term.contexts || linkTable.defaultContexts) {
    if (!allowedContexts.has(context)) errors.push(`${term.slug}: unknown context ${context}`);
    if (excludedContexts.has(context)) errors.push(`${term.slug}: excluded context ${context} is linkable`);
  }
  for (const language of ["zh", "en"]) {
    const rowAliases = term.aliases?.[language] || [];
    if (!rowAliases.length) errors.push(`${term.slug}: missing ${language} aliases`);
    if (new Set(rowAliases).size !== rowAliases.length) errors.push(`${term.slug}: duplicate ${language} aliases`);
    for (const alias of rowAliases) {
      if (alias.trim().length < 2) errors.push(`${term.slug}: alias too short (${alias})`);
    }
  }
}

const duplicateAliases = new Map();
for (const entry of glossaryAliasEntries) {
  const key = `${entry.language}:${entry.normalized}`;
  const slugs = duplicateAliases.get(key) || new Set();
  slugs.add(entry.slug);
  duplicateAliases.set(key, slugs);
}
for (const [key, slugs] of duplicateAliases) {
  if (slugs.size > 1) errors.push(`ambiguous alias ${key}: ${[...slugs].join(", ")}`);
}

for (const slug of expectedSlugs) {
  if (!localizedSearchPaths.includes(`/resources/glossary/${slug}/`)) errors.push(`missing route for ${slug}`);
}
for (const context of ["hero", "heading", "label", "nav", "button", "caption", "alt", "schema", "reference", "term"]) {
  if (!excludedContexts.has(context)) errors.push(`missing exclusion for ${context}`);
}

const sourceFiles = [
  "src/data/site/home.json",
  "src/data/site/about.json",
  "src/data/site/aboutVinner.json",
  "src/data/site/factory.json",
  "src/data/site/factoryQualification.json",
  "src/data/site/products.json",
  "src/data/site/resources.json",
  "src/data/legal/policies.json"
];
const flattenStrings = (value, result = []) => {
  if (typeof value === "string") result.push(value);
  else if (Array.isArray(value)) value.forEach((item) => flattenStrings(item, result));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => flattenStrings(item, result));
  return result;
};
const sourceText = sourceFiles.flatMap((file) => flattenStrings(JSON.parse(fs.readFileSync(path.join(root, file), "utf8"))));
const candidates = new Map(glossary.map((term) => [term.slug, 0]));
for (const entry of glossaryAliasEntries) {
  const hits = sourceText.filter((value) => {
    const haystack = entry.language === "en" ? value.toLocaleLowerCase("en-US") : value;
    return haystack.includes(entry.normalized);
  }).length;
  candidates.set(entry.slug, candidates.get(entry.slug) + hits);
}

if (errors.length) {
  console.error(`Glossary link table failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${linkTable.terms.length} glossary rows, ${glossaryAliasEntries.length} aliases, no collisions, all routes and exclusions valid.`);
  console.log("Candidate source-string matches:");
  for (const term of glossary) console.log(`- ${term.slug}: ${candidates.get(term.slug)}`);
}
