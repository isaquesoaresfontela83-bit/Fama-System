import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
export default defineConfig({
 root:resolve(root,'deployment/hybrid'),publicDir:resolve(root,'public'),
 plugins:[react(),{name:'no-private-modules-in-browser',enforce:'pre',resolveId(id){
  if (/^(cloudflare:|node:|pg$|next\/(headers|server)$)/.test(id)) throw new Error('Módulo exclusivo do servidor no navegador: '+id);
 }}],
 resolve:{alias:[{find:'@',replacement:root},{find:'next/link',replacement:resolve(root,'deployment/hybrid/link.jsx')},{find:'next/navigation',replacement:resolve(root,'deployment/hybrid/navigation.js')}]},
 define:{'process.env.NEXT_PUBLIC_FAMA_RUNTIME':JSON.stringify('hybrid'),'process.env.NODE_ENV':JSON.stringify('production')},
 server:{host:'0.0.0.0',allowedHosts:['terminal.local']},
 build:{outDir:resolve(root,'hybrid-dist'),emptyOutDir:true,sourcemap:false,manifest:true},
});
