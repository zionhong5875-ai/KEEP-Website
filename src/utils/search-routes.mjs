import glossary from "../data/site/glossary.json" with { type: "json" };
import products from "../data/site/products.json" with { type: "json" };
import resources from "../data/site/resources.json" with { type: "json" };
import policies from "../data/legal/policies.json" with { type: "json" };

// Deployment time is not an editorial update: omit unknown modification dates.
const modifiedDate = (value) => {
  const date = value?.replaceAll(".", "-");
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().startsWith(date) ? date : undefined;
};

export const searchRoutes = [
  ...glossary.map(term => ({ path: `/resources/glossary/${term.slug}/` })),
  ...["/", "/products/", "/about/vinner/", "/about/factory-qualification/", "/contact/", "/resources/", "/resources/all/", "/resources/blogs/", "/resources/news/", "/resources/files/", "/resources/glossary/"].map(path => ({ path })),
  ...Object.entries(policies).map(([slug, policy]) => ({ path: `/${slug}/`, lastmod: modifiedDate(policy.updatedAt) })),
  ...products.lines.map(line => ({ path: `/products/series/${line.slug}/` })),
  ...products.lines.flatMap(line => line.skus.filter(sku => !sku.comingSoon)
    .map(sku => ({ path: `/products/${sku.slug}/`, lastmod: modifiedDate(sku.updatedAt) }))),
  ...[...resources.news, ...resources.blogs].map(item => ({ path: `/resources/${item.slug}/`, lastmod: modifiedDate(item.updatedAt) }))
];

export const localizedSearchPaths = [...new Set(searchRoutes.flatMap(({ path }) => [path, `/en${path}`]))];

export function canonicalPath(path) {
  const normalized = `${path.replace(/\/+$/, "")}/`;
  return localizedSearchPaths.includes(normalized) ? normalized : null;
}

const escapeXml = value => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildSitemap(siteUrl) {
  const urls = searchRoutes.map(({ path, lastmod }) => {
    const zh = escapeXml(new URL(path, siteUrl).href);
    const en = escapeXml(new URL(`/en${path}`, siteUrl).href);
    const alternates = `    <xhtml:link rel="alternate" hreflang="zh-CN" href="${zh}" />\n    <xhtml:link rel="alternate" hreflang="en" href="${en}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${zh}" />`;
    return [zh, en].map(url => `  <url>\n    <loc>${url}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}${alternates}\n  </url>`).join("\n");
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}
