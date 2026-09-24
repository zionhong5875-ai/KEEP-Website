import published from "../data/site/glossary.json" with { type: "json" };

export const glossaryCategories = [
  { id: "factory", zh: "工厂资质", en: "Factory Qualifications" },
  { id: "testing", zh: "测试标准", en: "Testing Standards" },
  { id: "regulations", zh: "法律法规", en: "Laws & Regulations" },
  { id: "fundamentals", zh: "湿巾知识", en: "Wet Wipes Fundamentals" }
];
export const publishedTerms = [...published].sort((a, b) => a.title.en.localeCompare(b.title.en, "en"));
export const glossaryTerms = [...publishedTerms];
export const glossaryPath = (slug) => `/resources/glossary/${slug}/`;

const compactDescription = (value) => String(value || "").replace(/\s+/g, " ").trim();
const clipDescription = (value, language) => {
  const max = language === "en" ? 180 : 160;
  if (value.length <= max) return value;
  const clipped = value.slice(0, max - 1);
  const readable = language === "en" ? clipped.replace(/\s+\S*$/, "") : clipped;
  return `${readable}…`;
};

export const glossaryMetaDescription = (term, language) => {
  const minimum = language === "en" ? 70 : 30;
  const candidates = [
    term.summary?.[language],
    ...(term.definition?.[language] || []),
    ...(term.importance?.[language] || [])
  ].map(compactDescription).filter(Boolean);
  const source = candidates.find((value) => value.length >= minimum) || candidates.join(" ");
  return clipDescription(source, language);
};

