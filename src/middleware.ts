import { defineMiddleware } from "astro:middleware";
import { parse, parseFragment, serialize } from "parse5";
import { localizedPath, stripLanguagePrefix } from "./utils/i18n";
import { canIndexRequest } from "./utils/search-config.mjs";
import { canonicalPath } from "./utils/search-routes.mjs";

type HtmlNode = {
  nodeName?: string;
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
  parentNode?: HtmlNode;
};

const assetPrefixes = ["/_astro/", "/assets/", "/favicon", "/apple-touch-icon", "/site.js"];

const getAttr = (node: HtmlNode, name: string) =>
  node.attrs?.find((attribute) => attribute.name === name)?.value;

const setAttr = (node: HtmlNode, name: string, value: string) => {
  node.attrs ||= [];
  const attribute = node.attrs.find((item) => item.name === name);
  if (attribute) {
    attribute.value = value;
  } else {
    node.attrs.push({ name, value });
  }
};

const replaceContents = (node: HtmlNode, value: string, html = false) => {
  if (html) {
    const fragment = parseFragment(value) as HtmlNode;
    node.childNodes = fragment.childNodes || [];
    node.childNodes.forEach((child) => {
      child.parentNode = node;
    });
    return;
  }

  node.childNodes = [{ nodeName: "#text", value, parentNode: node }];
};

const shouldLocalizeHref = (href: string) => {
  if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/en/")) {
    return false;
  }

  return !["/api/", "/admin/", "/oauth", "/_astro/", "/assets/", "/favicon", "/apple-touch-icon", "/site.js", "/sitemap.xml", "/robots.txt"]
    .some((prefix) => href.startsWith(prefix));
};

const transformEnglishHtml = (html: string) => {
  const document = parse(html) as HtmlNode;

  const visit = (node: HtmlNode) => {
    if (node.tagName === "html") {
      setAttr(node, "lang", "en");
    }

    const english = getAttr(node, "data-en");
    if (english !== undefined) {
      if (node.tagName === "meta") {
        setAttr(node, "content", english);
      } else {
        replaceContents(node, english, getAttr(node, "data-i18n-html") === "true");
      }
    }

    const placeholder = getAttr(node, "data-placeholder-en");
    if (placeholder !== undefined) {
      setAttr(node, "placeholder", placeholder);
    }

    const ariaLabel = getAttr(node, "data-aria-label-en");
    if (ariaLabel !== undefined) {
      setAttr(node, "aria-label", ariaLabel);
    }

    const alt = getAttr(node, "data-alt-en");
    if (alt !== undefined) {
      setAttr(node, "alt", alt);
    }

    if (node.tagName === "a") {
      const href = getAttr(node, "href");
      if (href && shouldLocalizeHref(href)) {
        const [pathAndQuery, hash = ""] = href.split("#", 2);
        const [pathname, query = ""] = pathAndQuery.split("?", 2);
        setAttr(node, "href", `${localizedPath(pathname || "/", "en")}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`);
      }
    }

    node.childNodes?.forEach(visit);
  };

  visit(document);
  return serialize(document);
};

export const onRequest = defineMiddleware(async (context, next) => {
  if (["/robots.txt", "/sitemap.xml"].includes(context.url.pathname)) {
    return next();
  }

  const publicPathname = context.url.pathname;
  const isEnglish = publicPathname === "/en" || publicPathname.startsWith("/en/");
  const isAsset = assetPrefixes.some((prefix) => publicPathname.startsWith(prefix));

  const normalizedPath = canonicalPath(publicPathname);
  if (normalizedPath && normalizedPath !== publicPathname) {
    return context.redirect(`${normalizedPath}${context.url.search}`, 301);
  }

  context.locals.language = isEnglish ? "en" : "zh";
  context.locals.publicPathname = publicPathname;
  context.locals.indexable = canIndexRequest(context.url);

  let response: Response;
  if (isEnglish && !isAsset) {
    const rewriteUrl = new URL(stripLanguagePrefix(publicPathname), context.url);
    rewriteUrl.search = context.url.search;
    response = await next(rewriteUrl);
  } else {
    response = await next();
  }

  if (!context.locals.indexable || response.status >= 400 ||
    /^\/(?:en\/)?(?:admin|api|oauth)(?:\/|$)/.test(publicPathname)) {
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", "noindex, nofollow");
    response = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  if (!isEnglish || !response.headers.get("content-type")?.includes("text/html")) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("content-type", "text/html; charset=utf-8");

  return new Response(transformEnglishHtml(await response.text()), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
});
