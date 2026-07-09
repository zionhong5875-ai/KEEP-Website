const siteUrl = import.meta.env.PUBLIC_SITE_URL || "https://keep-website-ochre.vercel.app";

export const prerender = true;

export const GET = () =>
  new Response(
    [
      "User-agent: *",
      "Allow: /",
      `Sitemap: ${new URL("/sitemap.xml", siteUrl).toString()}`
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    }
  );
