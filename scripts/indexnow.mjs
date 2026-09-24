import fs from "node:fs";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { parse } from "parse5";
import { getSearchConfig, INDEXNOW_KEY } from "../src/utils/search-config.mjs";
import { localizedSearchPaths } from "../src/utils/search-routes.mjs";

export const endpoint = "https://api.indexnow.org/indexnow";

export function createSubmission(options, env) {
  const config = getSearchConfig(env);
  if (options.submit && (!env.PUBLIC_SITE_URL || !config.indexingEnabled)) {
    throw new Error("Submission requires explicit PUBLIC_SITE_URL and production indexing enabled.");
  }
  if (options.all && (options.url?.length || options.removed?.length)) {
    throw new Error("Choose --all or a list of --url/--removed paths, not both.");
  }
  if (options.submit && !options.all && !options.url?.length && !options.removed?.length) {
    throw new Error("Select --all for initial launch, or --url/--removed for changed pages.");
  }
  const toUrl = value => {
    const url = new URL(value, config.siteUrl);
    if (url.origin !== config.siteUrl || url.username || url.password || url.search || url.hash ||
      !url.pathname.endsWith("/") || /^\/(?:en\/)?(?:admin|api|oauth)(?:\/|$)/.test(url.pathname)) {
      throw new Error(`Not a clean public canonical URL: ${value}`);
    }
    return url.href;
  };
  const removed = [...new Set((options.removed || []).map(toUrl))];
  const paths = options.all || (!options.url?.length && !removed.length) ? localizedSearchPaths : (options.url || []);
  const active = [...new Set(paths.map(toUrl))];
  for (const url of active) {
    if (!localizedSearchPaths.includes(new URL(url).pathname)) throw new Error(`URL is not published in the local route registry: ${url}`);
  }
  if (removed.some(url => active.includes(url))) throw new Error("A URL cannot be active and removed in one submission.");
  const urlList = [...active, ...removed];
  if (!urlList.length) throw new Error("No URLs selected.");
  const keyFile = fs.readFileSync(new URL(`../public/${INDEXNOW_KEY}.txt`, import.meta.url), "utf8").trim();
  if (keyFile !== INDEXNOW_KEY) throw new Error("Local IndexNow key file does not match configuration.");
  return {
    active,
    removed,
    payload: { host: new URL(config.siteUrl).host, key: INDEXNOW_KEY,
      keyLocation: `${config.siteUrl}/${INDEXNOW_KEY}.txt`, urlList }
  };
}

function headValues(html) {
  const result = { canonicals: [], robots: [] };
  const visit = node => {
    const attr = name => node.attrs?.find(item => item.name === name)?.value;
    if (node.tagName === "link" && attr("rel") === "canonical") result.canonicals.push(attr("href"));
    if (node.tagName === "meta" && ["robots", "bingbot"].includes(attr("name")?.toLowerCase())) result.robots.push(attr("content"));
    node.childNodes?.forEach(visit);
  };
  const document = parse(html);
  const head = document.childNodes.find(node => node.tagName === "html")?.childNodes.find(node => node.tagName === "head");
  if (head) visit(head);
  return result;
}

export async function submitIndexNow(submission, fetcher = fetch) {
  const { payload, active, removed } = submission;
  const get = url => fetcher(url, { redirect: "manual", signal: AbortSignal.timeout(15000) });
  const key = await get(payload.keyLocation);
  if (key.status !== 200 || (await key.text()).trim() !== payload.key) {
    throw new Error("Public IndexNow key file is missing or different. Deploy this version first.");
  }
  const robots = await get(`https://${payload.host}/robots.txt`);
  if (robots.status !== 200 || /^\s*Disallow:\s*\/\s*$/mi.test(await robots.text())) {
    throw new Error("Public robots.txt is unavailable or blocks the entire site.");
  }
  // Verify the deployed pages, not just the local content registry, before sending.
  for (const url of active) {
    const response = await get(url);
    if (response.status !== 200 || /noindex|none/i.test(response.headers.get("x-robots-tag") || "")) {
      throw new Error(`Public page is not indexable: ${url} (HTTP ${response.status})`);
    }
    const head = headValues(await response.text());
    if (head.canonicals.length !== 1 || head.canonicals[0] !== url || head.robots.some(value => /noindex|none/i.test(value))) {
      throw new Error(`Canonical or robots meta does not match the public page: ${url}`);
    }
  }
  for (const url of removed) {
    const response = await get(url);
    const location = response.headers.get("location");
    const permanentRedirect = [301, 308].includes(response.status) && location && new URL(location, url).host === payload.host;
    if (![404, 410].includes(response.status) && !permanentRedirect) {
      throw new Error(`Removed URL must return 404, 410, or a same-host permanent redirect: ${url}`);
    }
  }
  const results = [];
  for (let start = 0; start < payload.urlList.length; start += 10000) {
    const batch = { ...payload, urlList: payload.urlList.slice(start, start + 10000) };
    const response = await fetcher(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(batch), signal: AbortSignal.timeout(15000), redirect: "error"
    });
    if (![200, 202].includes(response.status)) {
      throw new Error(`IndexNow returned HTTP ${response.status}; ${results.length} earlier batches accepted. Do not automatically resend accepted batches.`);
    }
    results.push({ status: response.status, urls: batch.urlList.length,
      state: response.status === 202 ? "received; key validation pending" : "received; indexing is not guaranteed" });
  }
  return results;
}

async function main() {
  const { values } = parseArgs({ options: {
    all: { type: "boolean" }, url: { type: "string", multiple: true },
    removed: { type: "string", multiple: true }, submit: { type: "boolean", default: false }
  } });
  const submission = createSubmission(values, process.env);
  if (!values.submit) {
    console.log(JSON.stringify({ mode: "dry-run; no network requests", endpoint, ...submission.payload }, null, 2));
    return;
  }
  console.log(JSON.stringify(await submitIndexNow(submission), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
