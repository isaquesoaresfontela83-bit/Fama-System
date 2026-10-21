import { createRequire, builtinModules } from 'node:module';
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
const require=createRequire(new URL('../../../package.json',import.meta.url)),serviceRequire=createRequire(new URL('../package.json',import.meta.url));
const {build}=require('esbuild'),directory=fileURLToPath(new URL('.',import.meta.url)),out=new URL('./dist/',import.meta.url);
await mkdir(out,{recursive:true});
const rustPath=fileURLToPath(import.meta.resolve('whatsapp-rust-bridge')),rust=await readFile(rustPath,'utf8');
// Keep the original Rust cryptography; compile its original non-SIMD WASM at deployment.
// Workerd does not permit dynamic compilation of the embedded bytes at runtime.
const match=rust.match(/initSync\(\{ module: base64ToUint8Array\("([A-Za-z0-9+/=]+)"\) \}\);/);
if(!match)throw new Error('The pinned Rust bridge changed; review its WASM initialization before building.');
const wasm=Buffer.from(match[1],'base64');await writeFile(new URL('rust-bridge.wasm',out),wasm);
const start=rust.indexOf('var forceNoSimd ='),end=rust.indexOf('export {',start);
if(start<0 || end<0)throw new Error('Could not locate pinned Rust bridge exports.');
const glue="import rustModule from './rust-bridge.wasm';\n"+rust.slice(0,start)+"initSync({module:rustModule});\nvar __wasmSimdActive=false;\n"+rust.slice(end);
const result=await build({entryPoints:[fileURLToPath(new URL('./index.mjs',import.meta.url))],bundle:true,minify:process.env.BAILEYS_MINIFY!=='0',format:'esm',platform:'node',target:'es2022',banner:{js:"import { createRequire as __famaCreateRequire } from 'node:module'; const require=__famaCreateRequire('file:///index.js');"},write:false,external:['node:*','cloudflare:*','./rust-bridge.wasm'],plugins:[{
    name:'workerd-transports',setup(plugin){
        plugin.onResolve({filter:/^ws$/},()=>({path:fileURLToPath(new URL('./websocket.mjs',import.meta.url))}));
        plugin.onResolve({filter:/^pino$/},()=>({path:fileURLToPath(new URL('./logger.mjs',import.meta.url))}));
        plugin.onResolve({filter:/^(?:sharp|jimp|audio-decode|link-preview-js)$/},()=>({path:fileURLToPath(new URL('./optional-media.mjs',import.meta.url))}));
        plugin.onResolve({filter:/^whatsapp-rust-bridge$/},()=>({path:rustPath,namespace:'workerd-rust'}));
        plugin.onResolve({filter:/^[A-Za-z]/},args=>builtinModules.includes(args.path)?{path:'node:'+args.path,external:true}:undefined);
        plugin.onLoad({filter:/.*/,namespace:'workerd-rust'},()=>({contents:glue,loader:'js',resolveDir:directory}));
    },
}]});
const code=result.outputFiles[0].text;await writeFile(new URL('index.js',out),code);
await writeFile(new URL('index.js.gz.b64',out),gzipSync(code,{level:9}).toString('base64'));
console.log(JSON.stringify({javascript:Buffer.byteLength(code),wasm:wasm.length,gzip:gzipSync(code).length}));
