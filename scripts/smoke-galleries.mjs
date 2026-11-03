// Manual live metadata check. No public HTML, images or screenshots are persisted.
import {cli} from './lib/io.mjs';import {discover} from './inspire-discover.mjs';
cli(import.meta.url,async o=>{const r=await discover({limit:24,out:o.out||'/tmp/dfs-gallery-smoke/candidates.json'});return {sources:r.sources,candidates:r.candidates.length,seedFallback:r.candidates.every(c=>c.from==='seed')};});
