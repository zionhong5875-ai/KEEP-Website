import { dev } from 'astro';
import { generateBacklinks } from './glossary-backlinks.mjs';
// A fresh render server ensures builds never depend on a previously visited page
// or a developer's running preview. It is closed even when generation fails.
process.env.VINNER_BACKLINK_RENDER = '1';
const server = await dev({ root: process.cwd(), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
try {
  console.log('Glossary backlinks:', await generateBacklinks(`http://127.0.0.1:${server.address.port}`, new URL('../src/generated/glossary-backlinks.json', import.meta.url)));
} finally { await server.stop(); }
