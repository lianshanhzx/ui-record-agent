await state.create('正式','R12','企业类','信贷正式客户');await state.exec('014-date-helpers');
const previous=state.inputValue;state.inputValue=label=>/证件号码|身份证/.test(label)?(label.includes('配偶')?'110101199203154789':'110101199203154770'):/电话/.test(label)?'01088881012':/账号/.test(label)?'6222020200001012':previous(label);
const source=fs.readFileSync(RUN+'/010-formal.js','utf8');const pre=source.slice(0,source.indexOf('const q=state.waitApi')).replace(/await r\.click\('企业规模测算',[\s\S]*?r\.note\('scaleCalculation',[^;]+;/,'');
await new(Object.getPrototypeOf(async function(){}).constructor)('page','fs','state','RUN',pre)(page,fs,state,RUN);
const r=state.rec,S=state.overview;for(const label of ['单位电话','法定代表人单位电话号码'])if(await r.loc(r.inp(label,S)).count())await r.input(label,r.inp(label,S),'01088881012');
for(const label of ['财务部联系人手机号码（短信通知）','联系号码/手机号码（短信通知）'])if(await r.loc(r.inp(label,S)).count())await r.input(label,r.inp(label,S),'13900001012');
if(await r.loc(r.inp('基本存款账户账号',S)).count())await r.input('基本存款账户账号',r.inp('基本存款账户账号',S),'6222020200001012');
if(await r.loc(r.field('法定代表人配偶客户编号',S)+'//button').count())await state.importNatural('法定代表人配偶客户编号',S,'AT_转正B_20260928');
for(const label of ['法定代表人配偶证件号码','法定代表人手机号码归属人身份证号码'])if(await r.loc(r.inp(label,S)).count()&&!(await r.loc(r.inp(label,S)).isDisabled()))await r.input(label,r.inp(label,S),'110101199203154789');
r.note('beforeTemporarySave',await r.inventory(state.overviewCSS));const q=page.waitForResponse(x=>x.url().includes('/tansun-tcp-cst/')&&/\/save/i.test(x.url())&&x.request().method()==='POST',{timeout:20000}).catch(()=>null);await r.click('正式客户概况暂存',r.btn('暂存',S));const response=await q;
if(!response){r.note('temporarySaveErrors',await page.locator('.el-form-item__error,.el-notification,.el-message').allTextContents());return r.finish('blocked','修正日期、电话号码及证件格式后，正式客户概况暂存仍无保存请求');}
const body=await response.json();r.note('temporarySaveResponse',{url:response.url(),request:response.request().postDataJSON(),body});if(body.status!==200)return r.finish('blocked',body.description||JSON.stringify(body));await state.returnList();await state.validatePersisted('正式');return r.finish();
