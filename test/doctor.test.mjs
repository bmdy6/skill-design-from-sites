import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('doctor reports usable dependencies and browser',()=>{const d=JSON.parse(execFileSync(process.execPath,['scripts/doctor.mjs','--json'],{encoding:'utf8'}));assert.equal(d.ok,true);assert.ok(d.steps.some(s=>s.name==='chromium'));});
