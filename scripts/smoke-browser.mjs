// Manual local-only browser smoke; output outside the repository.
import {cli} from './lib/io.mjs';import {serve} from '../test/helpers/serve.mjs';import {smoke} from './smoke-sites.mjs';
cli(import.meta.url,async o=>{const server=await serve(new URL('../test/fixtures',import.meta.url).pathname);try{return await smoke({url:server.url+'/site-a/',out:o.out||'/tmp/dfs-browser-smoke'});}finally{await server.close();}});
