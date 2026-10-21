import {readdir,stat,readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {gunzipSync} from 'node:zlib';
// Vite tests can restore raw WASM after the build; normalize it again at the publication boundary.
await import('./compress-runtime-assets.mjs');
const root=resolve(process.env.SITES_PROJECT_ROOT||process.cwd()),dist=join(root,'dist'),limit=25*1024*1024;
async function check(path){for(const item of await readdir(path,{withFileTypes:true})){const file=join(path,item.name);if(item.name==='.rsync-tmp'){await rm(file,{recursive:true,force:true});continue;}if(item.isDirectory()){await check(file);continue;}const size=(await stat(file)).size;if(size<=limit)continue;if(!file.endsWith('.wasm'))throw new Error(`Release asset exceeds hosting limit: ${relative(dist,file)}`);const encoded=await readFile(file+'.gz');if(encoded.length>limit||!gunzipSync(encoded).equals(await readFile(file)))throw new Error('Compressed runtime does not match the original.');// The SSR copy is not a browser asset. Keep its compressed bytes in place
// to avoid hydration restoring an oversized copy during archive staging.
const saved=join(root,'.sites-runtime/release-wasm-originals',relative(dist,file));await mkdir(resolve(saved,'..'),{recursive:true});if(relative(dist,file).startsWith('server/ssr/assets/')){await writeFile(saved,await readFile(file));await writeFile(file,encoded);}else await rename(file,saved);}}
// Browser worker bundles emitted into the SSR asset directory are unused on
// the server. Do not upload their WASM as executable Cloudflare modules.
const ssrAssets=join(dist,'server/ssr/assets');
for(const name of await readdir(ssrAssets)) {
  if (/^fama-local-ai\.worker-.*\.js$/.test(name) || /^ort-wasm-.*\.wasm(?:\.gz)?$/.test(name)) await rm(join(ssrAssets,name));
}
await check(dist);
// Compressed bytes must never masquerade as executable Worker WASM modules.
for (const name of await readdir(ssrAssets)) {
  if (!name.endsWith('.wasm')) continue;
  const bytes=await readFile(join(ssrAssets,name));
  if (bytes[0]===0x1f&&bytes[1]===0x8b) throw new Error(`Worker WASM module contains gzip bytes: ${name}`);
}
console.log('Release assets verified within the hosting size limit.');
