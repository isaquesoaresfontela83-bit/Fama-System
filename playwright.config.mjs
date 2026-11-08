import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'features/qa', testMatch:'*.e2e.mjs', fullyParallel:false, workers:1,
  reporter:[['list'],['html',{outputFolder:'artifacts/playwright',open:'never'}]],
  use:{baseURL:process.env.FAMA_QA_URL||'http://127.0.0.1:4173',trace:'retain-on-failure'},
  webServer:process.env.FAMA_QA_URL?undefined:{command:'node features/qa/server.mjs --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:false},
  projects:[{name:'desktop',use:{viewport:{width:1280,height:900}}},{name:'tablet',use:{viewport:{width:820,height:1180}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
});
