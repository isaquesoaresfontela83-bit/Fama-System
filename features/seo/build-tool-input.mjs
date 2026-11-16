import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
const deploy=await readFile(new URL('./deploy.mjs',import.meta.url),'utf8');
const entry=await readFile(new URL('./entry.mjs',import.meta.url),'utf8');
// Strip only top-level named export declarations, never exports in module strings.
const embedded=deploy.replace(/^export (?=(?:const|async function) )/gm,'');
const code=`async () => { ${embedded} return deploySEO(cloudflare,accountId,${JSON.stringify(entry)},true); }`;
new vm.Script('('+code+')');
if(!code.includes("export default withSEO(app,"))throw Error('Generated entry lost default export');
await writeFile('/tmp/fama-seo-tool-input.json',JSON.stringify({code}));
