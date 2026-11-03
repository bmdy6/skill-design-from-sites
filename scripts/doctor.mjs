import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {cli,exists} from './lib/io.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function doctor(){const steps=[];if(Number(process.versions.node.split('.')[0])<20)throw new Error('Node >=20 required');if(!await exists(path.join(root,'node_modules/playwright'))){execFileSync('npm',['ci'],{cwd:root,stdio:['ignore','ignore','inherit']});steps.push({name:'dependencies',status:'installed'});}else steps.push({name:'dependencies',status:'ok'});const {chromium}=await import('playwright');let installed=false;if(!await exists(chromium.executablePath())){execFileSync(process.execPath,[path.join(root,'node_modules/playwright/cli.js'),'install','chromium'],{stdio:['ignore','ignore','inherit']});installed=true;}steps.push({name:'chromium',status:installed?'installed':'ok'});const removed=await cleanShots(path.join(os.homedir(),'.cache/design-from-sites/shots'));steps.push({name:'cache-cleanup',status:'ok',detail:{removed}});return {ok:true,node:process.versions.node,steps};}
cli(import.meta.url,doctor);

export async function cleanShots(dir,now=Date.now()){let removed=0;for(const n of await fs.readdir(dir).catch(()=>[])){const p=path.join(dir,n),st=await fs.lstat(p);if(st.isFile()&&/\.(jpg|webp)$/.test(n)&&now-st.mtimeMs>30*86400000){await fs.unlink(p);removed++;}}return removed;}
