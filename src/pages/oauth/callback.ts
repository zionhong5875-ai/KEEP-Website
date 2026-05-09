import type { APIRoute } from "astro";

export const prerender = false;

const siteUrl = () => import.meta.env.PUBLIC_SITE_URL || "https://keep-website-ochre.vercel.app";

export const GET: APIRoute = async ({ url, redirect }) => {
  const code = url.searchParams.get("code");
  if (!code) {
    return redirect("/admin/?error=missing-code");
  }

  const redirectUri = new URL("/oauth/callback", siteUrl()).toString();
  const payload = {
    code,
    client_id: import.meta.env.OAUTH_GITHUB_CLIENT_ID,
    client_secret: import.meta.env.OAUTH_GITHUB_CLIENT_SECRET,
    redirect_uri: redirectUri,
    ...(import.meta.env.OAUTH_GITHUB_REPO_ID ? { repository_id: import.meta.env.OAUTH_GITHUB_REPO_ID } : {})
  };

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = await response.json();
    if (!response.ok || body.error || !body.access_token) {
      console.error("GitHub OAuth error:", response.status, body);
      throw new Error(body.error_description || body.error || "No access token received from GitHub");
    }

    const content = {
      token: body.access_token,
      provider: "github"
    };

    return new Response(
      `<script>
        const receiveMessage = (message) => {
          window.opener.postMessage(
            'authorization:${content.provider}:success:${JSON.stringify(content)}',
            message.origin
          );
          window.removeEventListener("message", receiveMessage, false);
        };
        window.addEventListener("message", receiveMessage, false);
        window.opener.postMessage("authorizing:${content.provider}", "*");
      </script>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      }
    );
  } catch (error) {
    console.error(error);
    return redirect("/admin/?error=oauth-failed");
  }
};
