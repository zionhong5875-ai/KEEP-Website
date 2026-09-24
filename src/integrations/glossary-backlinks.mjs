import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { generateBacklinks } from '../../scripts/glossary-backlinks.mjs';

export default function backlinks() {
  if (process.env.VINNER_BACKLINK_RENDER === '1') return { name: 'glossary-backlinks-render', hooks: {} };
  let base, timer, busy = false, pending = false, logger;
  const output = fileURLToPath(new URL('../generated/glossary-backlinks.json', import.meta.url));
  const update = async () => {
    if (!base) return;
    if (busy) { pending = true; return; }
    busy = true;
    try { logger.info(JSON.stringify(await generateBacklinks(base, output))); }
    catch (error) { logger.error(`Backlinks not refreshed: ${error.message}`); }
    finally { busy = false; if (pending) { pending = false; schedule(); } }
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(update, 600); };
  return { name: 'glossary-backlinks', hooks: {
    'astro:server:setup': ({ server, logger: log }) => {
      logger = log;
      server.watcher.on('all', (_event, path) => {
        if (path.includes('/src/') && !path.includes('/src/generated/') && /\.(astro|json|ts|mjs|js)$/.test(path)) schedule();
      });
    },
    'astro:server:start': ({ address }) => { base = `http://127.0.0.1:${address.port}`; schedule(); },
    'astro:server:done': () => { clearTimeout(timer); base = undefined; },
    'astro:build:start': async ({ logger }) => {
      const { stdout } = await promisify(execFile)(process.execPath, ['scripts/generate-glossary-backlinks.mjs'], { cwd: fileURLToPath(new URL('../../', import.meta.url)), env: { ...process.env, VINNER_BACKLINK_RENDER: '1' }, timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
      logger.info(stdout.trim());
    }
  }};
}
