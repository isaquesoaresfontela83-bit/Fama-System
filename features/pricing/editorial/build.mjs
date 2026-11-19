import {readFile,writeFile} from 'node:fs/promises';
const dir=new URL('./',import.meta.url),previous=new URL('../',import.meta.url);
const shared=await readFile(new URL('view.mjs',dir),'utf8');
const ssrHeader='import {O as interop,S as react,n as runtime} from "../index.js";const React=interop(react(),1),JSX=runtime();\n';
const clientHeader='import {r as interop} from "./rolldown-runtime-S-ySWqyJ.js?fama-plan=editorial-15.23.6";import {i as react,r as runtime} from "./framework-CXnKph_e.js?fama-plan=editorial-15.23.6";const React=interop(react(),1),JSX=runtime();\n';
const assets=JSON.parse(await readFile(new URL('client-assets.json',previous),'utf8'));
assets['/assets/plans-view-D-cAa3s9.js']=clientHeader+shared;
await writeFile(new URL('client-assets.json',dir),JSON.stringify(assets)+'\n');
await writeFile(new URL('ssr-plans-view.mjs',dir),ssrHeader+shared);
let core=await readFile(new URL('entry.mjs',previous),'utf8');core=core.replaceAll('15.23.5','15.23.6').replaceAll('2026-11-18-paid-plans-01','2026-11-18-editorial-pricing-01').replaceAll("replaceAll('plans-15173-1','pricing-15.23.6')","replaceAll('plans-15173-1','editorial-15.23.6').replaceAll('pricing-15.23.5','editorial-15.23.6').replaceAll('pricing-15.23.6','editorial-15.23.6')");
// The prior wrapper still points to the previous cache key. Refresh both graphs.
core=core.replaceAll(".replaceAll('pricing-15.23.5','editorial-15.23.6')", ".replaceAll('pricing-15.23.5','editorial-15.23.6')");
await writeFile(new URL('entry.mjs',dir),core);
console.log('Built shared SSR/client presentation and wrapper');
