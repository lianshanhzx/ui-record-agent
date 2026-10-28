state.rec = new (await import('file:///'+RUN.replace(/\\/g,'/')+'/recorder.cjs')).default(page,RUN,ROOT+'/partner-wire/corp',net);
state.exec = async name => {const C=Object.getPrototypeOf(async function(){}).constructor;return new C('page','context','browser','fs','path','state','net','ROOT','RUN','BASE','ROUTE',fs.readFileSync(RUN+'/'+name+'.js','utf8'))(page,context,browser,fs,path,state,net,ROOT,RUN,BASE,ROUTE);};
state.list=async()=>{await page.goto(BASE+ROUTE,{waitUntil:'domcontentloaded',timeout:30000});await page.locator('.el-table__body-wrapper tbody tr').first().waitFor({timeout:60000});};
state.waitApi=part=>page.waitForResponse(r=>r.url().includes(part)&&r.request().method()==='POST',{timeout:20000});
state.newData=kind=>{const stamp=Date.now().toString();const chars='0123456789ABCDEFGHJKLMNPQRTUWXY';return {name:'RR_20261012_'+kind+'_'+stamp,uscc:'91350'+Array.from({length:13},()=>chars[Math.floor(Math.random()*chars.length)]).join('')};};
fs.writeFileSync(RUN+'/list-inventory.json',JSON.stringify(await state.rec.inventory(),null,2));
return {ready:true,networkCount:net.length};
