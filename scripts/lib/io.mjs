import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export const readJSON=async p=>JSON.parse(await fs.readFile(p,'utf8'));
export async function writeJSON(p,v){await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n');}
export async function write(p,v){await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,v);}
export function args(argv=process.argv.slice(2)){const o={_:[]};for(let i=0;i<argv.length;i++){if(argv[i].startsWith('--')){const k=argv[i].slice(2);const v=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true;o[k]=o[k]===undefined?v:[...[o[k]].flat(),v];}else o._.push(argv[i]);}return o;}
export const main=fn=>{if(process.argv[1]&&import.meta.url!==pathToFileURL(process.argv[1]).href) return fn;};
export function cli(meta,fn){if(process.argv[1]&&meta===pathToFileURL(process.argv[1]).href)fn(args()).then(r=>{if(r!==undefined)console.log(JSON.stringify(r));}).catch(e=>{console.error(e.message);process.exitCode=e.exitCode||1;});}
export function fail(message,exitCode=2){throw Object.assign(new Error(message),{exitCode});}
export const exists=async p=>fs.access(p).then(()=>true,()=>false);
export async function files(p){const s=await fs.stat(p);return s.isDirectory()?(await Promise.all((await fs.readdir(p)).sort().map(n=>files(path.join(p,n))))).flat():[p];}
