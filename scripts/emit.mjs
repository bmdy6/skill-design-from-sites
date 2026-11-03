import StyleDictionary from 'style-dictionary';import path from 'node:path';import {cli,readJSON} from './lib/io.mjs';
export async function emit(o){const sd=new StyleDictionary({tokens:await readJSON(o.tokens),log:{verbosity:'silent'},platforms:{css:{transformGroup:'css',buildPath:path.resolve(o.out)+path.sep,files:[{destination:'tokens.css',format:'css/variables',options:{outputReferences:false}}]}}});await sd.buildAllPlatforms();return {ok:true};}
cli(import.meta.url,emit);
