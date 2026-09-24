import type { APIRoute } from "astro";
import { searchConfig, canIndexRequest, robotsText } from "../utils/search-config.mjs";

export const prerender = false;

export const GET: APIRoute = ({ url }) => new Response(robotsText(searchConfig, canIndexRequest(url)), {
  headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  }
});
