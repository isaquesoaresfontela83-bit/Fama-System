import {copyFile,mkdir} from 'node:fs/promises';
const runtime=new URL('../public/barcode-runtime/',import.meta.url);
await mkdir(runtime,{recursive:true});
await copyFile(new URL('../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm',import.meta.url),new URL('zxing-reader-3.0.1.wasm',runtime));
console.log('Barcode reader WASM prepared for same-origin delivery.');
