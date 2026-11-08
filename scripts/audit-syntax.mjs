import {readdir,readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
const roots=['apps/system/app','apps/system/lib','apps/system/hooks','apps/system/components','apps/system/db','apps/system/worker','apps/system/workers','apps/system/build','apps/system/server','apps/system/supabase','apps/control/app','apps/control/lib','apps/control/hooks','apps/control/components','apps/control/db','apps/control/worker','apps/control/workers','apps/control/build','apps/control/server','apps/control/supabase','features','deployment','scripts'];
let count=0;const failures=[];
async function visit(dir){
  let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
  for(const entry of entries){if(['node_modules','dist','.wrangler','.next','.git'].includes(entry.name))continue;const file=dir+'/'+entry.name;if(entry.isDirectory()){await visit(file);continue;}const extension=file.split('.').at(-1);if(!['js','jsx','mjs','cjs','ts','tsx'].includes(extension))continue;
    try{await transform(await readFile(file,'utf8'),{loader:['jsx','ts','tsx'].includes(extension)?extension:'js',target:'esnext',format:'esm',sourcefile:file});count++;}
    catch(error){failures.push({file,errors:error.errors?.map(item=>({line:item.location?.line,text:item.text}))||['Parse failed']});}
  }
}
for(const root of roots)await visit(root);
console.log(JSON.stringify({checked:count,failures},null,2));if(failures.length)process.exitCode=1;
