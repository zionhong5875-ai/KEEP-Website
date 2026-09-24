import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'parse5';
import { generateBacklinks } from './glossary-backlinks.mjs';
import terms from '../src/data/site/glossary.json' with { type: 'json' };
const base=process.env.AUDIT_BASE_URL || 'http://127.0.0.1:4321';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'backlinks-audit-'));
try {
  const output=path.join(temp,'index.json');
  const stats=await generateBacklinks(base,output);
  const expected=JSON.parse(await fs.readFile(output,'utf8'));
  assert.deepEqual(JSON.parse(await fs.readFile(new URL('../src/generated/glossary-backlinks.json',import.meta.url),'utf8')),expected,'generated index is stale');
  const walk=n=>[n,...(n.childNodes||[]).flatMap(walk)];
  const attr=(n,key)=>n.attrs?.find(a=>a.name===key)?.value;
  let empty=0;
  for(const lang of ['zh','en'])for(const term of terms){
    const response=await fetch(`${base}/${lang==='en'?'en/':''}resources/glossary/${term.slug}/`);
    assert.equal(response.status,200);
    const all=walk(parse(await response.text()));
    const actual=all.filter(n=>(attr(n,'class')||'').split(' ').includes('glossary-related-card')).map(n=>attr(n,'href'));
    const pages=expected[lang][term.slug]||[];
    assert.deepEqual(actual,pages.map(p=>p.href),`${lang}/${term.slug}: reverse cards mismatch`);
    if(!pages.length){
      empty++;
      assert.ok(all.some(n=>attr(n,'class')==='term-related-empty'),`${lang}/${term.slug}: missing empty state`);
      assert.ok(!all.some(n=>attr(n,'id')==='related-track'),'empty state should not display carousel');
    }
  }
  console.log(`PASS: ${stats.pages} source pages, ${stats.relations} unique backlinks, ${terms.length*2} localized term pages, ${empty} empty states.`);
} finally { await fs.rm(temp,{recursive:true,force:true}); }
