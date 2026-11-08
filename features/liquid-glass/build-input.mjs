import {readFile} from 'node:fs/promises';
const read = name => readFile(new URL(name,import.meta.url),'utf8');
const touch = (await read('touch-feedback.mjs')).replace('export function','function');
export const input = {
  baseline:JSON.parse(await read('baseline-15.23.2.json')),
  entry:await read('entry.mjs'),
  css:await read('styles.css'),
  resources:{
    '/assets/fama-dock-client-15.23.2.mjs':touch+'\ninstallTouchFeedback();\n'+await read('dock-client.mjs'),
    '/assets/fama-dock-model-15.23.2.mjs':await read('dock-preferences.mjs'),
  },
};
