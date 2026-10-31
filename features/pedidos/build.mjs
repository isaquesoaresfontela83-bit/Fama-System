import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {existsSync} from 'node:fs';
import {VERSION,RELEASE} from './model.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const dist=join(root,'dist');await mkdir(dist,{recursive:true});
const localBinary=join(root,'../../apps/system/node_modules/.bin/esbuild');
const executable=process.env.FAMA_ESBUILD_BIN||(existsSync(localBinary)?localBinary:'esbuild');
function run(args,input){const result=spawnSync(executable,args,{cwd:root,input,encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr||'Falha na compilação do módulo Pedidos.');}
run(['entry.mjs','--bundle','--format=esm','--platform=neutral','--target=es2022','--minify',`--outfile=${join(dist,'pedidos-core.mjs')}`]);
const client=(await readFile(join(root,'client.mjs'),'utf8')).replace('./fama-pedidos-model-15.21.0.mjs','./model.mjs');
run(['--bundle','--format=esm','--platform=browser','--target=es2022','--minify','--sourcefile=client.mjs',`--outfile=${join(dist,'client.mjs')}`],client);
run(['styles.css','--minify',`--outfile=${join(dist,'styles.css')}`]);
const resources={
 [`/assets/fama-pedidos-${VERSION}.mjs`]:{type:'application/javascript; charset=utf-8',body:await readFile(join(dist,'client.mjs'),'utf8')},
 [`/assets/fama-pedidos-${VERSION}.css`]:{type:'text/css; charset=utf-8',body:await readFile(join(dist,'styles.css'),'utf8')},
};
await writeFile(join(dist,'pedidos-resources.mjs'),'export default '+JSON.stringify(resources)+';\n');
for(const app of ['system','control'])await writeFile(join(dist,`${app}-main.mjs`),`import app from './index.js';\nimport {withOrders} from './pedidos-core.mjs';\nimport resources from './pedidos-resources.mjs';\nexport default withOrders(app,resources,${JSON.stringify(app)});\n`);
console.log(JSON.stringify({version:VERSION,release:RELEASE,assets:Object.keys(resources),directory:dist}));
