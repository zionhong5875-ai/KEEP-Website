import type { APIRoute } from "astro";

export const prerender = false;

const siteUrl = () => import.meta.env.PUBLIC_SITE_URL || "https://keep-website-ochre.vercel.app";

export const GET: APIRoute = ({ redirect }) => {
  const redirectUri = new URL("/oauth/callback", siteUrl()).toString();
  const params = new URLSearchParams({
    client_id: import.meta.env.OAUTH_GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "repo,user"
  });

  return redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
};
