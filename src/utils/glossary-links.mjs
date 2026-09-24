import published from "../data/site/glossary.json" with { type: "json" };
import linkTable from "../data/site/glossary-links.json" with { type: "json" };

const languageKeys = ["zh", "en"];
const isEnglishWord = (value) => /[A-Za-z0-9]/.test(value || "");
const normalizeAlias = (value, language) => language === "en" ? value.toLocaleLowerCase("en-US") : value;

export const glossaryLinkTable = linkTable;
export const glossaryLinkTerms = linkTable.terms;

const aliases = glossaryLinkTerms.flatMap((term) => languageKeys.flatMap((language) =>
  (term.aliases?.[language] || []).map((alias) => ({
    alias,
    normalized: normalizeAlias(alias, language),
    language,
    slug: term.slug,
    priority: term.priority || 0,
    contexts: term.contexts || linkTable.defaultContexts
  }))
));

const sortedAliases = (language, context) => aliases
  .filter((entry) => entry.language === language && entry.contexts.includes(context))
  .sort((a, b) => b.normalized.length - a.normalized.length || b.priority - a.priority);

const matchesAt = (value, index, entry) => {
  const source = normalizeAlias(value, entry.language);
  if (!source.startsWith(entry.normalized, index)) return false;
  if (entry.language !== "en") return true;
  const before = value[index - 1];
  const after = value[index + entry.alias.length];
  const first = entry.alias[0];
  const last = entry.alias.at(-1);
  return !(isEnglishWord(first) && isEnglishWord(before)) && !(isEnglishWord(last) && isEnglishWord(after));
};

/**
 * Split plain text into safe text/link segments. This function never parses or
 * emits HTML, so it cannot create nested anchors or alter existing markup.
 */
export const linkGlossaryText = (value, language = "zh", context = "body") => {
  const source = String(value || "");
  const entries = sortedAliases(language, context);
  if (!source || !entries.length) return [{ text: source }];
  const segments = [];
  let plainStart = 0;
  let index = 0;
  while (index < source.length) {
    const match = entries.find((entry) => matchesAt(source, index, entry));
    if (!match) {
      index += 1;
      continue;
    }
    if (plainStart < index) segments.push({ text: source.slice(plainStart, index) });
    segments.push({ text: source.slice(index, index + match.alias.length), slug: match.slug });
    index += match.alias.length;
    plainStart = index;
  }
  if (plainStart < source.length) segments.push({ text: source.slice(plainStart) });
  return segments.length ? segments : [{ text: source }];
};

export const glossaryAliasEntries = aliases;

export const glossaryLinkTargets = new Set(published.map((term) => term.slug));
