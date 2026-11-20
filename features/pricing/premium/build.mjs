import { readFile } from 'node:fs/promises';
import { PREFIX } from './entry.mjs';

export async function buildResources() {
 const resources = {};
 const types = { 'app.js': 'application/javascript', 'catalog.js': 'application/javascript', 'theme.js': 'application/javascript', 'style.css': 'text/css' };
 for (const [file, type] of Object.entries(types)) {
  resources[PREFIX + file] = { type, body: await readFile(new URL(file, import.meta.url), 'utf8') };
 }
 let html = await readFile(new URL('index.html', import.meta.url), 'utf8');
 html = html.replaceAll('https://watersystem.online/fama-piscinas-mark.png', '/fama-piscinas-mark.png');
 for (const file of Object.keys(types)) {
  html = html.replaceAll('"' + file + '"', '"' + PREFIX + file + '"');
 }
 html = html.replace('</head>', '<link rel="canonical" href="https://watersystem.online/"><!--FAMA_CATALOG--></head>');
 resources.html = { type: 'text/html', body: html };
 return resources;
}
