import fs from "node:fs";
import { parse } from "parse5";

const baseUrl = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4321";
const products = JSON.parse(fs.readFileSync(new URL("../src/data/site/products.json", import.meta.url)));
const resources = JSON.parse(fs.readFileSync(new URL("../src/data/site/resources.json", import.meta.url)));
const authors = JSON.parse(fs.readFileSync(new URL("../src/data/site/authors.json", import.meta.url)));
const policies = JSON.parse(fs.readFileSync(new URL("../src/data/legal/policies.json", import.meta.url)));
const glossary = JSON.parse(fs.readFileSync(new URL("../src/data/site/glossary.json", import.meta.url)));

const routes = [...new Set([
  "/",
  "/products/",
  "/about/vinner/",
  "/about/factory-qualification/",
  "/contact/",
  "/resources/",
  "/resources/all/",
  "/resources/blogs/",
  "/resources/news/",
  "/resources/files/",
  "/resources/glossary/",
  ...Object.keys(policies).map((slug) => `/${slug}/`),
  ...products.lines.map((line) => `/products/series/${line.slug}/`),
  ...products.lines.flatMap((line) => line.skus.filter((sku) => !sku.comingSoon).map((sku) => `/products/${sku.slug}/`)),
  ...resources.news.map((item) => `/resources/${item.slug}/`),
  ...resources.blogs.map((item) => `/resources/${item.slug}/`),
  ...glossary.map((term) => `/resources/glossary/${term.slug}/`)
])];

const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
const descendants = (node, predicate, result = []) => {
  if (predicate(node)) result.push(node);
  node.childNodes?.forEach((child) => descendants(child, predicate, result));
  return result;
};
const first = (node, predicate) => descendants(node, predicate, [])[0];
const content = (node) => descendants(node, (child) => child.nodeName === "#text", [])
  .map((child) => child.value || "")
  .join(" ")
  .replace(/\s+/g, " ")
  .trim();
const pathForLanguage = (route, language) => language === "en" ? `/en${route}` : route;
const hasAncestor = (node, predicate) => {
  let current = node.parentNode;
  while (current) {
    if (predicate(current)) return true;
    current = current.parentNode;
  }
  return false;
};

const results = [];
const warnings = [];
for (const language of ["zh", "en"]) {
  for (const route of routes) {
    const pathname = pathForLanguage(route, language);
    const response = await fetch(new URL(pathname, baseUrl));
    const html = await response.text();
    const document = parse(html);
    const main = first(document, (node) => node.tagName === "main");
    const htmlNode = first(document, (node) => node.tagName === "html");
    const title = content(first(document, (node) => node.tagName === "title") || {});
    const description = attr(first(document, (node) => node.tagName === "meta" && attr(node, "name") === "description") || {}, "content") || "";
    const canonical = attr(first(document, (node) => node.tagName === "link" && attr(node, "rel") === "canonical") || {}, "href") || "";
    const metaContent = (attribute, value) => attr(first(document, (node) => node.tagName === "meta" && attr(node, attribute) === value) || {}, "content") || "";
    const openGraph = {
      title: metaContent("property", "og:title"),
      description: metaContent("property", "og:description"),
      url: metaContent("property", "og:url"),
      image: metaContent("property", "og:image")
    };
    const twitterCard = metaContent("name", "twitter:card");
    const alternates = descendants(document, (node) => node.tagName === "link" && attr(node, "rel") === "alternate")
      .map((node) => ({ language: attr(node, "hreflang"), href: attr(node, "href") }));
    const headings = Object.fromEntries([1, 2, 3].map((level) => [
      `h${level}`,
      main ? descendants(main, (node) => node.tagName === `h${level}`).length : 0
    ]));
    const images = descendants(document, (node) => node.tagName === "img");
    const missingAlt = images.filter((image) => attr(image, "alt") === undefined).length;
    const objectAlt = images.filter((image) => (attr(image, "alt") || "").includes("[object Object]")).length;
    const unexplainedEmptyAlt = images.filter((image) => attr(image, "alt") === "" && !hasAncestor(image, (parent) =>
      parent.tagName === "button" || attr(parent, "aria-hidden") === "true" || attr(parent, "class")?.includes("footer-socials") ||
      (parent.tagName === "a" && (attr(parent, "aria-label") || attr(parent, "title")))
    )).length;
    const figures = main ? descendants(main, (node) => node.tagName === "figure") : [];
    const isArticleWindow = (figure) =>
      attr(figure, "class")?.split(/\s+/).includes("article-product-window-media") ||
      hasAncestor(figure, (parent) => attr(parent, "class")?.split(/\s+/).includes("article-product-window"));
    const requiresCaption = (figure) =>
      attr(figure, "class")?.includes("about-location-media") ||
      attr(figure, "class")?.includes("term-illustration") ||
      (hasAncestor(figure, (parent) => attr(parent, "class")?.split(/\s+/).includes("resource-detail")) && !isArticleWindow(figure));
    const missingRequiredCaptions = figures.filter((figure) => {
      const hasImage = Boolean(first(figure, (node) => node.tagName === "img"));
      const hasCaption = Boolean(first(figure, (node) => node.tagName === "figcaption"));
      return hasImage && requiresCaption(figure) && !hasCaption;
    }).length;
    const unexpectedCaptions = figures.filter((figure) => {
      const hasCaption = Boolean(first(figure, (node) => node.tagName === "figcaption"));
      return hasCaption && !requiresCaption(figure);
    }).length;
    const malformedCaptions = figures.filter((figure) => {
      const caption = first(figure, (node) => node.tagName === "figcaption");
      return caption && (!content(caption).startsWith("*") || !attr(caption, "class")?.includes("site-image-caption"));
    }).length;
    const expectedPath = pathname;
    const canonicalPath = canonical ? new URL(canonical).pathname : "";
    const alternateCodes = new Set(alternates.map((item) => item.language));
    const expectedAlternatePaths = {
      "zh-CN": route,
      en: `/en${route}`,
      "x-default": route
    };
    const invalidAlternates = alternates.filter((item) =>
      !expectedAlternatePaths[item.language] || new URL(item.href).pathname !== expectedAlternatePaths[item.language]
    ).length;
    const internalLinks = descendants(document, (node) => node.tagName === "a")
      .map((node) => attr(node, "href"))
      .filter(Boolean);
    const unlocalizedEnglishLinks = language === "en" ? internalLinks.filter((href) =>
      href.startsWith("/") &&
      !href.startsWith("/en/") &&
      href !== "/en" &&
      !["/api/", "/admin/", "/oauth", "/_astro/", "/assets/", "/favicon", "/site.js"].some((prefix) => href.startsWith(prefix))
    ).length : 0;
    const schemaDocuments = descendants(document, (node) => node.tagName === "script" && attr(node, "type") === "application/ld+json")
      .flatMap((node) => {
        try {
          const parsed = JSON.parse(content(node));
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return [];
        }
      });
    const schemas = schemaDocuments.flatMap((schema) => Array.isArray(schema?.["@graph"])
      ? schema["@graph"]
      : [schema]
    );
    const typesFor = (schema) => Array.isArray(schema?.["@type"])
      ? schema["@type"]
      : schema?.["@type"] ? [schema["@type"]] : [];
    const hasType = (schema, type) => typesFor(schema).includes(type);
    const schemaTypes = new Set(schemas.flatMap(typesFor));
    const schemaByType = (type) => schemas.find((schema) => hasType(schema, type));
    const organizationSchema = schemas.find((schema) => hasType(schema, "Organization") && schema.legalName);
    const isResourceCollection = ["/resources/", "/resources/all/", "/resources/blogs/", "/resources/news/", "/resources/files/", "/resources/glossary/"].includes(route);
    const isGlossaryTerm = route.startsWith("/resources/glossary/") && !isResourceCollection;
    const expectedPageType = route === "/about/vinner/"
      ? "AboutPage"
      : route === "/contact/"
        ? "ContactPage"
        : route === "/products/" || route === "/about/factory-qualification/" || route.startsWith("/products/series/") || isResourceCollection
          ? "CollectionPage"
          : isGlossaryTerm || route.startsWith("/products/") || route.startsWith("/resources/")
            ? "ItemPage"
            : "WebPage";
    const pageSchema = schemaByType(expectedPageType);
    const graphIds = schemas.map((schema) => schema?.["@id"]).filter(Boolean);
    const duplicateGraphIds = graphIds.filter((id, index) => graphIds.indexOf(id) !== index);
    const expectsBreadcrumb = route !== "/";
    const expectsCollection = expectedPageType === "CollectionPage";
    const expectsProductSchema = route.startsWith("/products/") && route !== "/products/" && !route.startsWith("/products/series/");
    const expectsArticleSchema = route.startsWith("/resources/") && !isResourceCollection && !isGlossaryTerm;
    const productSchema = schemaByType("Product");
    const expectedArticleType = resources.blogs.some((item) => `/resources/${item.slug}/` === route)
      ? "BlogPosting"
      : "NewsArticle";
    const articleSchema = expectsArticleSchema ? schemaByType(expectedArticleType) : undefined;
    const organizationId = organizationSchema?.["@id"];
    const referenceId = (value) => value?.["@id"];
    const blog = resources.blogs.find(item => `/resources/${item.slug}/` === route);
    const expectedAuthor = blog && authors[blog.authorId];
    const visibleAuthor = first(document, node => attr(node, "class") === "resource-detail-author");
    const authorErrors = [];
    if (blog) {
      if (!expectedAuthor) authorErrors.push("blog has no registered author");
      else {
        const person = articleSchema?.author;
        const authorUrl = `${new URL(canonical).origin}${pathForLanguage("/contact/", language)}#${blog.authorId}`;
        if (person?.["@type"] !== "Person" || person.name !== expectedAuthor.name[language] || person.jobTitle !== expectedAuthor.role[language]) authorErrors.push("incorrect author name, type or job title");
        if (person?.["@id"] !== `${new URL(canonical).origin}/#person-${blog.authorId}` || person?.url !== authorUrl || referenceId(person?.worksFor) !== organizationId) authorErrors.push("author identity or affiliation mismatch");
        if (content(first(visibleAuthor || {}, node => node.tagName === "strong") || {}) !== expectedAuthor.name[language] || content(first(visibleAuthor || {}, node => node.tagName === "span") || {}) !== expectedAuthor.role[language]) authorErrors.push("visible byline differs from author schema");
        if (metaContent("name", "author") !== expectedAuthor.name[language]) authorErrors.push("author meta mismatch");
      }
    }
    const glossaryTermSchema = isGlossaryTerm ? schemaByType("DefinedTerm") : undefined;
    const definitionSection = isGlossaryTerm ? first(document, node => attr(node, "aria-labelledby") === "definition-title") : undefined;
    const errors = [
      response.status !== 200 && `HTTP ${response.status}`,
      attr(htmlNode || {}, "lang") !== (language === "en" ? "en" : "zh-CN") && "wrong html lang",
      !title && "missing title",
      !description && "missing meta description",
      headings.h1 !== 1 && `${headings.h1} H1 elements`,
      headings.h2 < 1 && "missing H2",
      headings.h3 < 1 && "missing H3",
      missingAlt > 0 && `${missingAlt} images missing alt`,
      objectAlt > 0 && `${objectAlt} invalid object alt values`,
      unexplainedEmptyAlt > 0 && `${unexplainedEmptyAlt} unexplained empty alt values`,
      missingRequiredCaptions > 0 && `${missingRequiredCaptions} required image captions missing`,
      unexpectedCaptions > 0 && `${unexpectedCaptions} image captions outside approved contexts`,
      malformedCaptions > 0 && `${malformedCaptions} malformed figure captions`,
      canonicalPath !== expectedPath && `canonical path ${canonicalPath || "missing"}`,
      !["zh-CN", "en", "x-default"].every((code) => alternateCodes.has(code)) && "incomplete hreflang set",
      invalidAlternates > 0 && `${invalidAlternates} invalid hreflang targets`,
      unlocalizedEnglishLinks > 0 && `${unlocalizedEnglishLinks} internal links leave English URL tree`,
      openGraph.title !== title && "Open Graph title mismatch",
      openGraph.description !== description && "Open Graph description mismatch",
      (!openGraph.url || new URL(openGraph.url).pathname !== expectedPath) && "Open Graph URL mismatch",
      !openGraph.image && "missing Open Graph image",
      twitterCard !== "summary_large_image" && "missing large Twitter card",
      schemaDocuments.length !== 1 && `${schemaDocuments.length} JSON-LD documents instead of 1`,
      schemaDocuments[0]?.["@context"] !== "https://schema.org" && "missing Schema.org context",
      !Array.isArray(schemaDocuments[0]?.["@graph"]) && "structured data is not an @graph",
      duplicateGraphIds.length > 0 && `duplicate schema @id values: ${[...new Set(duplicateGraphIds)].join(", ")}`,
      !organizationSchema && "missing Organization structured data",
      organizationSchema?.name !== "Vinner" && `Organization name is ${organizationSchema?.name || "missing"}`,
      organizationSchema?.legalName !== "Vinner (Shenzhen) Health Products Limited" && `Organization legalName is ${organizationSchema?.legalName || "missing"}`,
      !organizationId?.endsWith("/#organization") && "Organization does not use the canonical @id",
      !schemaTypes.has("WebSite") && "missing WebSite structured data",
      !pageSchema && `missing ${expectedPageType} structured data`,
      pageSchema && new URL(pageSchema.url).pathname !== expectedPath && `${expectedPageType} URL mismatch`,
      pageSchema && pageSchema.inLanguage !== (language === "en" ? "en" : "zh-CN") && `${expectedPageType} language mismatch`,
      expectsBreadcrumb && !schemaTypes.has("BreadcrumbList") && "missing BreadcrumbList structured data",
      expectsBreadcrumb && referenceId(pageSchema?.breadcrumb) !== `${pageSchema?.url}#breadcrumb` && "page does not reference its breadcrumb",
      expectsCollection && !schemaTypes.has("ItemList") && "missing ItemList structured data",
      isGlossaryTerm && !glossaryTermSchema && "missing DefinedTerm structured data",
      isGlossaryTerm && content(definitionSection || {}).length < (language === "en" ? 80 : 40) && "glossary definition is missing substantive visible text",
      isGlossaryTerm && glossaryTermSchema && referenceId(pageSchema?.mainEntity) !== glossaryTermSchema["@id"] && "glossary page mainEntity does not reference DefinedTerm",
      route === "/resources/glossary/" && !schemaTypes.has("DefinedTermSet") && "glossary page is missing DefinedTermSet structured data",
      !Object.keys(policies).some((slug) => `/${slug}/` === route) && !referenceId(pageSchema?.mainEntity) && "page is missing mainEntity",
      expectsProductSchema && !schemaTypes.has("Product") && "missing Product structured data",
      expectsProductSchema && referenceId(productSchema?.manufacturer) !== organizationId && "Product manufacturer does not reference Vinner",
      expectsProductSchema && !productSchema?.brand?.name && "Product brand is missing",
      expectsProductSchema && referenceId(productSchema?.mainEntityOfPage) !== `${pageSchema?.url}#webpage` && "Product mainEntityOfPage mismatch",
      expectsArticleSchema && !articleSchema && `missing ${expectedArticleType} structured data`,
      expectsArticleSchema && !articleSchema?.datePublished && "Article datePublished is missing",
      ...authorErrors,
      expectsArticleSchema && articleSchema?.dateModified && articleSchema.dateModified < articleSchema.datePublished && "Article modification precedes publication",
      expectsArticleSchema && metaContent("property", "article:published_time") !== articleSchema?.datePublished && "Article publication meta mismatch",
      expectsArticleSchema && articleSchema?.dateModified && metaContent("property", "article:modified_time") !== articleSchema.dateModified && "Article modification meta mismatch",
      expectsArticleSchema && referenceId(articleSchema?.publisher) !== organizationId && "Article publisher does not reference Vinner",
      expectsArticleSchema && referenceId(articleSchema?.mainEntityOfPage) !== `${pageSchema?.url}#webpage` && "Article mainEntityOfPage mismatch",
      route === "/about/factory-qualification/" && !schemaTypes.has("Certification") && "qualification page is missing Certification entities",
      route === "/about/factory-qualification/" && !schemaTypes.has("GovernmentPermit") && "qualification page is missing GovernmentPermit entities",
      route === "/about/factory-qualification/" && !schemaTypes.has("Report") && "qualification page is missing Report entities",
      route === "/resources/" && !schemaTypes.has("DigitalDocument") && "resources page is missing DigitalDocument entities"
    ].filter(Boolean);

    const titleLimit = language === "en" ? 70 : 45;
    const descriptionRange = language === "en" ? [70, 180] : [30, 160];
    if (title.length > titleLimit) warnings.push(`${pathname}: title is ${title.length} characters`);
    if (description.length < descriptionRange[0] || description.length > descriptionRange[1]) {
      warnings.push(`${pathname}: meta description is ${description.length} characters`);
    }

    results.push({ language, route, pathname, title, description, headings, images: images.length, missingAlt, missingRequiredCaptions, unexpectedCaptions, errors });
  }
}

const sitemapResponse = await fetch(new URL("/sitemap.xml", baseUrl));
const sitemap = await sitemapResponse.text();
const sitemapLocations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const sitemapAlternates = [...sitemap.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)]
  .map((match) => ({ language: match[1], href: match[2] }));
const expectedPaths = new Set(routes.flatMap((route) => [route, `/en${route}`]));
const sitemapPaths = new Set(sitemapLocations.map((location) => new URL(location).pathname));
const sitemapErrors = [
  sitemapResponse.status !== 200 && `HTTP ${sitemapResponse.status}`,
  sitemapLocations.length !== expectedPaths.size && `${sitemapLocations.length} URLs instead of ${expectedPaths.size}`,
  [...expectedPaths].some((path) => !sitemapPaths.has(path)) && "missing localized URL entries",
  sitemapAlternates.length !== expectedPaths.size * 3 && `${sitemapAlternates.length} alternates instead of ${expectedPaths.size * 3}`,
  !sitemapAlternates.every((item) => ["zh-CN", "en", "x-default"].includes(item.language)) && "invalid hreflang codes"
].filter(Boolean);
const legacyRedirects = [
  ["/about/factory/", "/about/vinner/"],
  ["/en/about/factory/", "/en/about/vinner/"]
];
const redirectErrors = [];
for (const [source, destination] of legacyRedirects) {
  const response = await fetch(new URL(source, baseUrl), { redirect: "manual" });
  const location = response.headers.get("location");
  if (response.status !== 301 || !location || new URL(location, baseUrl).pathname !== destination) {
    redirectErrors.push(`${source}: expected 301 to ${destination}, received ${response.status} to ${location || "nowhere"}`);
  }
}

const duplicateValues = (key) => {
  const counts = new Map();
  for (const result of results) {
    const value = result[key];
    const scopedValue = `${result.language}\u0000${value}`;
    counts.set(scopedValue, (counts.get(scopedValue) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([scopedValue, count]) => [scopedValue.split("\u0000")[1], count])
    .filter(([value, count]) => value && count > 1);
};

const failures = results.filter((result) => result.errors.length > 0);
console.log(`SEO audit: ${results.length} localized pages (${routes.length} routes x 2 languages)`);
console.log(`Passed: ${results.length - failures.length}; failed: ${failures.length}`);
console.log(`Sitemap: ${sitemapLocations.length} URLs; ${sitemapAlternates.length} language alternates; errors: ${sitemapErrors.length}`);
console.log(`Legacy redirects: ${legacyRedirects.length}; errors: ${redirectErrors.length}`);
for (const result of failures) {
  console.log(`- ${result.pathname}: ${result.errors.join("; ")}`);
}
for (const [label, key] of [["title", "title"], ["description", "description"]]) {
  const duplicates = duplicateValues(key);
  if (duplicates.length) {
    console.log(`Duplicate ${label} values:`);
    duplicates.forEach(([value, count]) => console.log(`- ${count}x ${value}`));
  }
}
if (sitemapErrors.length) console.log(`Sitemap errors: ${sitemapErrors.join("; ")}`);
if (redirectErrors.length) console.log(`Redirect errors: ${redirectErrors.join("; ")}`);
if (warnings.length) {
  console.log(`Metadata length advisories: ${warnings.length}`);
  warnings.forEach((warning) => console.log(`- ${warning}`));
}

if (failures.length > 0 || sitemapErrors.length > 0 || redirectErrors.length > 0 || duplicateValues("title").length > 0 || duplicateValues("description").length > 0) {
  process.exitCode = 1;
}
