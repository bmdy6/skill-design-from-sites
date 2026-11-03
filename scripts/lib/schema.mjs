import Ajv from 'ajv';import {readJSON,fail} from './io.mjs';
const ajv=new Ajv({allErrors:true,strict:false});const validators={};
for(const name of ['raw','evidence','labels','sources','merge-report','feedback','check-report']){validators[name]=ajv.compile(await readJSON(new URL(`../../schemas/${name}.schema.json`,import.meta.url)));}
export function validate(name,value){const check=validators[name];if(!check)fail(`Unknown schema ${name}`);if(!check(value))fail(`${name}: ${ajv.errorsText(check.errors)}`);return value;}
export function addSchema(name,schema){validators[name]=ajv.compile(schema);}
