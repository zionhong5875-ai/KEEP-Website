import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import decapCmsOauth from "astro-decap-cms-oauth";
import glossaryBacklinks from "./src/integrations/glossary-backlinks.mjs";

export default defineConfig({
  output: "server",
  adapter: vercel(),
  integrations: [
    glossaryBacklinks(),
    decapCmsOauth({
      oauthDisabled: true
    })
  ]
});
