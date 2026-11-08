import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {transform} from 'esbuild';
import {input} from '../features/liquid-glass/build-input.mjs';
import {VERSION,RELEASE} from '../features/pedidos/model.mjs';
const read=file=>readFile(new URL('../'+file,import.meta.url),'utf8');
const sha=source=>createHash('sha256').update(source).digest('hex');
const modules={
  'glass-main.mjs':"import app from './pedidos-main.mjs';\nimport {withLiquidGlass} from './glass-core.mjs';\nimport css from './glass-styles.mjs';\nimport resources from './glass-client-resources.mjs';\nexport default withLiquidGlass(app,css,resources);\n",
  'glass-core.mjs':input.entry,
  'glass-styles.mjs':'export default '+JSON.stringify(input.css)+';\n',
  'glass-client-resources.mjs':'export default '+JSON.stringify(input.resources)+';\n',
  'pedidos-core.mjs':await read('features/pedidos/dist/pedidos-core.mjs'),
  'pedidos-resources.mjs':await read('features/pedidos/dist/pedidos-resources.mjs'),
};
for(const [name,source]of Object.entries(modules))await transform(source,{loader:'js',format:'esm',target:'es2022',sourcefile:name});
for(const [name,source]of Object.entries(input.resources))await transform(source,{loader:'js',format:'esm',target:'es2022',sourcefile:name});
const applications={};
for(const kind of ['system','control']){
  const appModules={...modules,'pedidos-main.mjs':await read(`features/pedidos/dist/${kind}-main.mjs`)};
  const base=input.baseline[kind];
  const preserved=base.modules.filter(item=>!Object.hasOwn(appModules,item.name));
  if(preserved.length!==(kind==='system'?120:53))throw new Error('Unexpected production baseline');
  applications[kind]={activeVersion:base.version,baselineHash:base.sha256,preservedModules:preserved.length,updatedModules:Object.entries(appModules).map(([name,body])=>({name,sha256:sha(body),bytes:Buffer.byteLength(body)}))};
}
await mkdir('features/audit/dist',{recursive:true});
await writeFile('features/audit/dist/candidate-modules.json',JSON.stringify({shared:modules,systemMain:await read('features/pedidos/dist/system-main.mjs'),controlMain:await read('features/pedidos/dist/control-main.mjs')}));
const manifest={version:VERSION,releaseId:RELEASE,state:'local-candidate-not-deployed',applications};
await writeFile('features/audit/dist/release-manifest.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest,null,2));
