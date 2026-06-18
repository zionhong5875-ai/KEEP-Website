# VINNER CMS Setup

This Astro site is CMS-ready through Decap CMS. The editing entry is `/admin/`.

## What editors can change

- Site settings, navigation text, Footer, social links, and WeChat QR code
- Homepage hero, company intro, metrics, R&D section, product-line section, partners, news, and blog headings
- Product lines, series-page copy, SKU cards, product images, specifications, gallery images, SDS, Brochure, and downloads
- About Vinner, factory introduction, factory qualification certificates, and contact-page content
- News, blog cards, digital resource cards, and PDF downloads such as SDS files
- Legal policy text

## Local editing

Decap CMS supports local editing during development:

```bash
npm run dev
```

Then open:

```text
http://localhost:4321/admin/
```

For full local CMS editing, run Decap's local backend in another terminal:

```bash
npx decap-server
```

## GitHub editing

Production CMS editing needs a GitHub repository and a Decap/GitHub OAuth setup. Update `public/admin/config.yml`:

```yaml
backend:
  name: github
  repo: YOUR_ORG/YOUR_REPO
  branch: main
```

For non-technical staff, deploy the site and give them access to:

```text
https://YOUR_DOMAIN/admin/
```

They can update JSON-backed content under `src/data/` and upload media without touching code.

## Production login

The CMS uses GitHub OAuth on Vercel:

```yaml
site_domain: keep-website-ochre.vercel.app
base_url: https://keep-website-ochre.vercel.app
auth_endpoint: oauth
```

If the final Vercel URL is different, update these two values in `public/admin/config.yml` and redeploy:

- `site_domain`
- `base_url`

Create a GitHub OAuth App at:

```text
https://github.com/settings/applications/new
```

Use:

```text
Homepage URL: https://keep-website-ochre.vercel.app
Authorization callback URL: https://keep-website-ochre.vercel.app/oauth/callback
```

Then put the Client ID and Client Secret into Vercel environment variables:

```text
OAUTH_GITHUB_CLIENT_ID
OAUTH_GITHUB_CLIENT_SECRET
```

## Editor workflow

1. Open `/admin/`.
2. Log in with the invited GitHub account.
3. Choose `官网内容`.
4. Edit `全站设置`, `首页`, `产品与 SKU`, `关于维尼`, `工厂介绍`, `工厂资质`, `联系页面`, `新闻、博客与数字资源`, or `合规页面`.
5. To replace an image, click the image field and upload/select a file.
6. To add SDS or PDF downloads, use the `上传文件` field in `博客与资源 > 数字资源` or in a product SKU's `下载资源`.
7. Click `Publish`. The CMS commits the change to GitHub.
8. Vercel rebuilds the website automatically after the commit.

For the non-technical editor handoff, use `BUSINESS_EDITOR_GUIDE.md`.

## Image rules for editors

- Use horizontal images for hero and large modules.
- Prefer 2000px wide JPG/WebP images.
- Always fill in the Alt text field.
- Avoid screenshots, watermarked images, and low-resolution product photos.
