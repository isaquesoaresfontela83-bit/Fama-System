import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('artifacts/security',{recursive:true});
const scans=await Promise.all(['.','apps/system','apps/control'].map(cwd=>new Promise(resolve=>{
  const child=spawn('npm',['audit','--package-lock-only','--json','--fetch-timeout=20000','--fetch-retries=0'],{cwd,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.resume();
  child.on('error',error=>resolve({cwd,error:error.message}));
  child.on('close',async code=>{
    let report;try{report=JSON.parse(output);}catch{resolve({cwd,error:'Scanner did not return JSON',code});return;}
    const name=cwd==='.'?'tooling':cwd.split('/').at(-1);
    await writeFile(`artifacts/security/npm-audit-${name}.json`,JSON.stringify(report,null,2));
    resolve({cwd,code,counts:report.metadata?.vulnerabilities,error:report.error?.summary});
  });
})));
console.log(JSON.stringify(scans,null,2));
if(scans.some(scan=>scan.error||!scan.counts||scan.counts.high>0||scan.counts.critical>0))process.exitCode=1;
