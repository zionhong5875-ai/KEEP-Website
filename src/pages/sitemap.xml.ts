import { buildSitemap } from "../utils/search-routes.mjs";
import { searchConfig } from "../utils/search-config.mjs";

export const prerender = true;

export const GET = () => new Response(buildSitemap(searchConfig.siteUrl), {
  headers: { "Content-Type": "application/xml; charset=utf-8" }
});
