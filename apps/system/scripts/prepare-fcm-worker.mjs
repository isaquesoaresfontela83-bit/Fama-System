import {build} from 'esbuild';
await build({entryPoints:['app/firebase-worker.js'],outfile:'public/firebase-messaging-sw.js',bundle:true,minify:true,platform:'browser',format:'iife',target:['es2022'],legalComments:'none'});
console.log('Firebase messaging worker bundled for same-origin delivery.');
