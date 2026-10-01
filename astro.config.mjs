import { defineConfig } from "astro/config";
import edgeone from "@edgeone/astro";
import decapCmsOauth from "astro-decap-cms-oauth";
import glossaryBacklinks from "./src/integrations/glossary-backlinks.mjs";

export default defineConfig({
  output: "server",
  adapter: edgeone(),
  integrations: [
    glossaryBacklinks(),
    decapCmsOauth({
      oauthDisabled: true
    })
  ]
});
