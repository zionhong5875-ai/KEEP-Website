# KEEP Deployment Notes

## Production Stack

- Frontend: Astro
- Hosting and serverless backend: Vercel
- CMS: Decap CMS editing JSON content in GitHub
- Email delivery: Resend
- Lead storage: Feishu Bitable
- Optional instant alert: Feishu Bot Webhook

## Deploy to Vercel

1. Push this project to GitHub.
2. Import the GitHub repository in Vercel.
3. Use these Vercel settings:
   - Framework Preset: Astro
   - Build Command: `npm run build`
   - Output Directory: leave as Vercel default
4. Add the environment variables from `.env.example`.
5. Deploy.

## Contact Form Environment Variables

Required for email:

```text
RESEND_API_KEY=
CONTACT_FROM=KEEP Website <noreply@your-domain.com>
CONTACT_TO=sales@your-domain.com
```

Required for Feishu Bitable storage:

```text
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_BITABLE_APP_TOKEN=
FEISHU_BITABLE_TABLE_ID=
```

Optional for Feishu group notifications:

```text
FEISHU_WEBHOOK_URL=
```

## Feishu Bitable Fields

Create these fields in the target table:

- `Name`
- `Email`
- `Company`
- `Need`
- `Message`
- `Source`
- `CreatedAt`

## CMS Production Requirements

Decap CMS needs a GitHub repository and OAuth login. The repo is configured as:

```yaml
backend:
  name: github
  repo: zionhong5875-ai/KEEP-Website
  branch: main
  site_domain: keep-website.vercel.app
  base_url: https://keep-website.vercel.app
  auth_endpoint: oauth
```

Then invite editors to the GitHub repository with limited write access. Editors use `/admin/` to change copy, images, SKUs, news, blogs, and resources.

Create a GitHub OAuth App:

```text
Homepage URL: https://keep-website.vercel.app
Authorization callback URL: https://keep-website.vercel.app/oauth/callback
```

Add these Vercel environment variables:

```text
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GITHUB_CLIENT_SECRET=
```
