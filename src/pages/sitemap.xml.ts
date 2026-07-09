import products from "../data/site/products.json";
import resources from "../data/site/resources.json";
import { getProductLineMeta } from "../utils/productLines";

const siteUrl = import.meta.env.PUBLIC_SITE_URL || "https://keep-website-ochre.vercel.app";

export const prerender = true;

const staticRoutes = [
  "/",
  "/products/",
  "/about/vinner/",
  "/about/factory/",
  "/about/factory-qualification/",
  "/contact/",
  "/resources/",
  "/privacy/",
  "/cookies/",
  "/disclaimer/",
  "/copyright/"
];

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const routes = [
  ...staticRoutes,
  ...products.lines.map((line) => `/products/series/${getProductLineMeta(line).slug}/`),
  ...products.lines.flatMap((line) => line.skus.map((sku) => `/products/${sku.slug}/`)),
  ...resources.news.map((item) => `/resources/${item.slug}/`),
  ...resources.blogs.map((item) => `/resources/${item.slug}/`)
];

export const GET = () => {
  const urls = [...new Set(routes)]
    .map((route) => {
      const loc = escapeXml(new URL(route, siteUrl).toString());
      return `  <url><loc>${loc}</loc></url>`;
    })
    .join("\n");

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
};
