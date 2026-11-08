import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const result=spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'});
if(result.status!==0)throw new Error('Cannot enumerate repository files');
const files=[...new Set(result.stdout.split('\0').filter(Boolean))],findings=[];
const signatures=[['private_key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],['github_token',/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],['stripe_secret',/\bsk_live_[A-Za-z0-9]{20,}\b/g],['supabase_secret',/\bsb_secret_[A-Za-z0-9_-]{24,}\b/g],['aws_access_key',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g]];
for(const file of files){if(!/\.(?:[mc]?jsx?|tsx?|jsonc?|md|sql|ya?ml|sh|txt|py|toml)$/.test(file)||file.endsWith('package-lock.json'))continue;
  let source;try{source=await readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')continue;throw error;}
  for(const [kind,pattern]of signatures)for(const match of source.matchAll(pattern)){
    if(/fixture|example|placeholder/i.test(match[0]))continue;
    // This test constructs a fresh key at runtime; no PEM material is stored in source.
    if(kind==='private_key'&&file.includes('/tests/')&&source.slice(match.index).split('-----END PRIVATE KEY-----',1)[0].includes('crypto.subtle.exportKey'))continue;
    findings.push({file,line:source.slice(0,match.index).split('\n').length,kind});
  }
  for(const match of source.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){
    try{if(JSON.parse(Buffer.from(match[1],'base64url').toString()).role==='service_role')findings.push({file,line:source.slice(0,match.index).split('\n').length,kind:'service_role_jwt'});}catch{/* Non-JWT strings are not credentials. */}
  }
}
console.log(JSON.stringify({checkedFiles:files.length,findings},null,2));if(findings.length)process.exitCode=1;
