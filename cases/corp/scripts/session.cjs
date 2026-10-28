const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const ROOT = path.resolve(__dirname, '../..');
const RUN = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/cstMgt/csinfMnt/cpctMgt/cpctMgtPg';
const state = {};
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context = await browser.newContext({viewport:{width:1440,height:900},locale:'zh-CN'});
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const net = [];
  page.on('response', async r => {
    if (!r.url().includes('/tansun-tcp-cst/') && !r.url().includes('filesFileManage') && !r.url().includes('filesCtlgManage')) return;
    try { net.push({time:new Date().toISOString(),url:r.url(),request:r.request().postDataJSON(),response:await r.json()}); } catch {}
  });
  const rl = readline.createInterface({input:process.stdin,terminal:false});
  console.log('SESSION_READY');
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const command = JSON.parse(line);
      const result = await new AsyncFunction('page','context','browser','fs','path','state','net','ROOT','RUN','BASE','ROUTE',command.code)(page,context,browser,fs,path,state,net,ROOT,RUN,BASE,ROUTE);
      fs.writeFileSync(path.join(RUN,'network-evidence.json'),JSON.stringify(net,null,2));
      console.log('RESULT '+JSON.stringify(result));
    } catch(e) { console.log('ERROR '+e.stack); }
  }
  await browser.close();
})();
